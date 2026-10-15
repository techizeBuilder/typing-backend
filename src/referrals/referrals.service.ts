import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { PlanSubscription } from '../entities/plan.entity';
import { ReferralCommission, ReferralPayout } from '../entities/referral.entity';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../entities/app_setting.entity';
import { hasPremiumAccess } from '../common/premium';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const UPI = /^[\w.-]{2,}@[a-zA-Z][\w.-]{1,}$/;

export interface ReferralSettings {
  enabled: boolean;
  commission_pct: number;
  premium_commission_pct: number;
  discount_pct: number;
  min_payout: number;
}

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PlanSubscription) private readonly subs: Repository<PlanSubscription>,
    @InjectRepository(ReferralCommission) private readonly commissions: Repository<ReferralCommission>,
    @InjectRepository(ReferralPayout) private readonly payouts: Repository<ReferralPayout>,
    private readonly settings: SettingsService,
  ) {}

  async getSettings(): Promise<ReferralSettings> {
    const all = await this.settings.getAll();
    const int = (k: string, d: number) => {
      const n = parseInt(all[k], 10);
      return Number.isFinite(n) ? n : d;
    };
    return {
      enabled: all[SETTING_KEYS.REFERRAL_ENABLED] !== 'false',
      commission_pct: int(SETTING_KEYS.REFERRAL_COMMISSION_PCT, 10),
      premium_commission_pct: int(SETTING_KEYS.REFERRAL_PREMIUM_COMMISSION_PCT, 15),
      discount_pct: int(SETTING_KEYS.REFERRAL_DISCOUNT_PCT, 10),
      min_payout: int(SETTING_KEYS.REFERRAL_MIN_PAYOUT, 100),
    };
  }

  // Admins and super admins always; sub-admins with the 'plans' permission.
  async assertStaff(userId: string) {
    const u = await this.users.findOne({ where: { id: userId } });
    if (u && (u.role === UserRole.ADMIN || u.role === UserRole.SUPERADMIN)) return;
    if (u && u.role === UserRole.SUBADMIN && (u.permissions || []).includes('plans')) return;
    throw new ForbiddenException('You do not have access to referrals.');
  }

  private async ensureCode(user: User): Promise<string> {
    if (user.referral_code) return user.referral_code;
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      if (await this.users.exist({ where: { referral_code: code } })) continue;
      await this.users.update({ id: user.id }, { referral_code: code });
      return code;
    }
    throw new BadRequestException('Could not create a referral code. Please try again.');
  }

  private normalise(code: unknown) {
    return String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  }

  async findReferrer(code: unknown): Promise<User | null> {
    const c = this.normalise(code);
    if (!c) return null;
    const u = await this.users.findOne({ where: { referral_code: c } });
    return u && u.role === UserRole.STUDENT ? u : null;
  }

  // Public: is this code valid (for the sign-up page)? Shows only a first name.
  async check(code: unknown) {
    const s = await this.getSettings();
    const ref = s.enabled ? await this.findReferrer(code) : null;
    return ref ? { valid: true, discount_pct: s.discount_pct, referrer: String(ref.name || '').split(' ')[0] } : { valid: false };
  }

  // Sign-up: remember who referred the new student.
  async attributeOnSignup(newUserId: string, code: unknown) {
    const s = await this.getSettings();
    if (!s.enabled) return;
    const ref = await this.findReferrer(code);
    if (!ref || ref.id === newUserId) return;
    await this.users.update({ id: newUserId }, { referred_by: ref.id, referred_at: new Date() });
  }

  private async hasPaidPlan(studentId: string, exceptSubId?: string) {
    return this.subs.exist({ where: { student_id: studentId, status: 'Active', ...(exceptSubId ? { id: Not(exceptSubId) } : {}) } });
  }

  // Discount for a plan request: first plan only, through the sign-up referral
  // or a code entered now (which then becomes the student's referrer).
  async discountForRequest(student: User, code: unknown): Promise<{ referrer_id: string | null; discount_pct: number }> {
    const none = { referrer_id: null, discount_pct: 0 };
    const s = await this.getSettings();
    if (!s.enabled || (await this.hasPaidPlan(student.id))) return none;
    let referrerId = student.referred_by || null;
    if (!referrerId && this.normalise(code)) {
      const ref = await this.findReferrer(code);
      if (!ref) throw new BadRequestException('That referral code is not valid.');
      if (ref.id === student.id) throw new BadRequestException('You cannot use your own referral code.');
      referrerId = ref.id;
      await this.users.update({ id: student.id }, { referred_by: ref.id, referred_at: new Date() });
    }
    return referrerId ? { referrer_id: referrerId, discount_pct: s.discount_pct } : none;
  }

  // What the student would get now (for the Plan & Pricing page).
  async preview(student: User) {
    const s = await this.getSettings();
    const firstPlan = !(await this.hasPaidPlan(student.id));
    return {
      enabled: s.enabled,
      referred: !!student.referred_by,
      first_plan: firstPlan,
      discount_pct: s.enabled && firstPlan ? s.discount_pct : 0,
    };
  }

  // Called inside the plan-activation transaction.
  async creditOnActivation(m: EntityManager, sub: PlanSubscription, student: User) {
    const s = await this.getSettings();
    if (!s.enabled || !student.referred_by || !sub.amount_paid || sub.amount_paid <= 0) return null;
    const earlier = await m.exists(PlanSubscription, { where: { student_id: student.id, status: 'Active', id: Not(sub.id) } });
    if (earlier) return null;
    const referrer = await m.findOne(User, { where: { id: student.referred_by } });
    if (!referrer) return null;
    const rate = hasPremiumAccess(referrer) ? s.premium_commission_pct : s.commission_pct;
    const amount = Math.round((sub.amount_paid * rate) / 100);
    if (amount <= 0) return null;
    return m.save(ReferralCommission, m.create(ReferralCommission, {
      referrer_id: referrer.id, referred_id: student.id, subscription_id: sub.id,
      plan_name: sub.plan_name, base_amount: sub.amount_paid, rate, amount,
    }));
  }

  private async totals(referrerId: string) {
    const [earned, requested, paid] = await Promise.all([
      this.commissions.sum('amount', { referrer_id: referrerId }),
      this.payouts.sum('amount', { referrer_id: referrerId, status: 'Requested' }),
      this.payouts.sum('amount', { referrer_id: referrerId, status: 'Paid' }),
    ]);
    const e = earned || 0; const r = requested || 0; const p = paid || 0;
    return { total_earned: e, requested: r, paid_out: p, balance: e - r - p };
  }

  async mine(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.STUDENT) throw new ForbiddenException('Refer & Earn is for students.');
    const [code, s, totals, referred, commissions, payouts] = await Promise.all([
      this.ensureCode(user),
      this.getSettings(),
      this.totals(user.id),
      this.users.find({ where: { referred_by: user.id }, order: { created_at: 'DESC' }, take: 200 }),
      this.commissions.find({ where: { referrer_id: user.id } }),
      this.payouts.find({ where: { referrer_id: user.id }, order: { created_at: 'DESC' }, take: 50 }),
    ]);
    const byReferred = new Map(commissions.map((c) => [c.referred_id, c]));
    return {
      code,
      settings: s,
      rate: hasPremiumAccess(user) ? s.premium_commission_pct : s.commission_pct,
      premium: hasPremiumAccess(user),
      stats: { total_referrals: referred.length, converted: commissions.length, ...totals },
      referrals: referred.map((r) => {
        const c = byReferred.get(r.id);
        return { name: r.name, joined_at: r.referred_at || r.created_at, plan: c?.plan_name || null, commission: c?.amount || 0, commission_at: c?.created_at || null };
      }),
      payouts,
    };
  }

  async requestPayout(userId: string, body: any) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.STUDENT) throw new ForbiddenException('Only students can request payouts.');
    const s = await this.getSettings();
    const amount = Number(body?.amount);
    const upi = String(body?.upi_id ?? '').trim();
    if (!UPI.test(upi) || upi.length > 100) throw new BadRequestException('Enter a valid UPI ID, e.g. name@okaxis.');
    if (!Number.isInteger(amount) || amount < s.min_payout) throw new BadRequestException(`The minimum payout is ₹${s.min_payout}.`);
    if (await this.payouts.exist({ where: { referrer_id: user.id, status: 'Requested' } })) throw new BadRequestException('You already have a payout request in progress.');
    const { balance } = await this.totals(user.id);
    if (amount > balance) throw new BadRequestException(`You can withdraw at most ₹${balance}.`);
    return this.payouts.save(this.payouts.create({ referrer_id: user.id, amount, upi_id: upi, status: 'Requested' }));
  }

  // ── Staff ──
  async overview() {
    const [commissions, payouts] = await Promise.all([
      this.commissions.find({ order: { created_at: 'DESC' } }),
      this.payouts.find({ order: { created_at: 'DESC' } }),
    ]);
    const ids = [...new Set([...commissions.flatMap((c) => [c.referrer_id, c.referred_id]), ...payouts.map((p) => p.referrer_id)])];
    const users = ids.length ? await this.users.find({ where: { id: In(ids) } }) : [];
    const who = new Map(users.map((u) => [u.id, { name: u.name, user_id: u.user_id, phone: u.phone }]));
    const referredCount = await this.users.count({ where: { referred_by: Not(IsNull()) } });
    const sum = (rows: { amount: number }[]) => rows.reduce((n, r) => n + r.amount, 0);
    return {
      settings: await this.getSettings(),
      overview: {
        referred_students: referredCount,
        converted: commissions.length,
        commissions_total: sum(commissions),
        paid_out: sum(payouts.filter((p) => p.status === 'Paid')),
        pending_payouts: sum(payouts.filter((p) => p.status === 'Requested')),
      },
      commissions: commissions.map((c) => ({ ...c, referrer: who.get(c.referrer_id), referred: who.get(c.referred_id) })),
      payouts: payouts.map((p) => ({ ...p, referrer: who.get(p.referrer_id) })),
    };
  }

  private async pending(id: string) {
    const p = UUID.test(id || '') ? await this.payouts.findOne({ where: { id } }) : null;
    if (!p) throw new NotFoundException('Payout request not found.');
    if (p.status !== 'Requested') throw new BadRequestException(`This payout is already ${p.status.toLowerCase()}.`);
    return p;
  }

  async markPaid(staffId: string, id: string, body: any) {
    const p = await this.pending(id);
    const ref = String(body?.payment_ref ?? '').trim();
    if (!ref || ref.length > 100) throw new BadRequestException('Enter the payment reference (UPI transaction ID).');
    Object.assign(p, { status: 'Paid', payment_ref: ref, admin_note: String(body?.admin_note ?? '').trim().slice(0, 300) || null, processed_at: new Date(), processed_by: staffId });
    return this.payouts.save(p);
  }

  async reject(staffId: string, id: string, body: any) {
    const p = await this.pending(id);
    Object.assign(p, { status: 'Rejected', admin_note: String(body?.admin_note ?? '').trim().slice(0, 300) || null, processed_at: new Date(), processed_by: staffId });
    return this.payouts.save(p);
  }
}
