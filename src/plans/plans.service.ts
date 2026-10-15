import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Plan, PlanSubscription, PLAN_CATEGORIES } from '../entities/plan.entity';
import { User, UserRole } from '../entities/user.entity';
import { ReferralsService } from '../referrals/referrals.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PENDING = 3;

// Local calendar date helpers (validity dates are plain dates).
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + days));
};
const today = () => ymd(new Date());
const dateOnly = (v: any) => (v ? (typeof v === 'string' ? v.slice(0, 10) : ymd(new Date(v))) : null);

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PlanSubscription) private readonly subs: Repository<PlanSubscription>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly referrals: ReferralsService,
  ) {}

  // Admins and super admins always; sub-admins with the 'plans' permission.
  async assertStaff(userId: string) {
    const u = await this.users.findOne({ where: { id: userId } });
    if (u && (u.role === UserRole.ADMIN || u.role === UserRole.SUPERADMIN)) return;
    if (u && u.role === UserRole.SUBADMIN && (u.permissions || []).includes('plans')) return;
    throw new ForbiddenException('You do not have access to plans.');
  }

  // ─── Plans ────────────────────────────────────────────────────────────────
  listPublic() {
    return this.plans.find({ where: { is_active: true }, order: { sort_order: 'ASC', price: 'DESC' } });
  }

  async listAdmin() {
    const [plans, counts] = await Promise.all([
      this.plans.find({ order: { sort_order: 'ASC', price: 'DESC' } }),
      this.subs.createQueryBuilder('s')
        .select('s.plan_id', 'plan_id')
        .addSelect('COUNT(*)', 'n')
        .where(`s.status = 'Active' AND s.ends_on >= :t`, { t: today() })
        .groupBy('s.plan_id')
        .getRawMany(),
    ]);
    const active = new Map(counts.map((c) => [c.plan_id, Number(c.n)]));
    return plans.map((p) => ({ ...p, active_subscriptions: active.get(p.id) || 0 }));
  }

  private cleanPlan(body: any, partial: boolean): Partial<Plan> {
    const out: Partial<Plan> = {};
    const has = (k: string) => body?.[k] !== undefined;
    const int = (k: string, min: number, max: number, nullable = false) => {
      if (!has(k)) { if (!partial && !nullable) throw new BadRequestException(`${k} is required.`); return; }
      if (nullable && (body[k] === null || body[k] === '')) { (out as any)[k] = null; return; }
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${k} must be a whole number from ${min} to ${max}.`);
      (out as any)[k] = n;
    };
    if (has('name') || !partial) {
      const n = String(body?.name ?? '').trim();
      if (!n) throw new BadRequestException('name is required.');
      if (n.length > 60) throw new BadRequestException('name must be at most 60 characters.');
      out.name = n;
    }
    if (has('tagline')) {
      const t = String(body.tagline ?? '').trim();
      if (t.length > 150) throw new BadRequestException('tagline must be at most 150 characters.');
      out.tagline = t || null;
    }
    if (has('category') || !partial) {
      const c = body?.category ?? 'all';
      if (!PLAN_CATEGORIES.includes(c)) throw new BadRequestException(`category must be one of: ${PLAN_CATEGORIES.join(', ')}.`);
      out.category = c;
    }
    int('price', 0, 1000000);
    int('original_price', 0, 1000000, true);
    int('duration_days', 1, 1095);
    int('sort_order', 0, 100000, true);
    if (out.sort_order === null) out.sort_order = 0;
    for (const k of ['preload_tests_limit', 'steno_tests_limit', 'live_tests_limit']) int(k, 0, 100000, true);
    for (const k of ['popular', 'is_active']) {
      if (!has(k)) continue;
      if (typeof body[k] !== 'boolean') throw new BadRequestException(`${k} must be true or false.`);
      (out as any)[k] = body[k];
    }
    if (has('features')) {
      if (!Array.isArray(body.features) || body.features.length > 20) throw new BadRequestException('features must be a list of at most 20 items.');
      out.features = body.features.map((f: any) => {
        const label = String(f?.label ?? '').trim();
        if (!label || label.length > 150) throw new BadRequestException('Each feature needs a label of at most 150 characters.');
        return { label, included: f?.included !== false };
      });
    }
    const price = out.price ?? undefined;
    const orig = out.original_price ?? undefined;
    if (price !== undefined && orig !== undefined && orig !== null && orig < price) {
      throw new BadRequestException('original_price must not be lower than price.');
    }
    return out;
  }

  async createPlan(body: any) {
    return this.plans.save(this.plans.create(this.cleanPlan(body, false)));
  }

  async updatePlan(id: string, body: any) {
    const plan = UUID.test(id || '') ? await this.plans.findOne({ where: { id } }) : null;
    if (!plan) throw new NotFoundException('Plan not found.');
    const patch = this.cleanPlan(body, true);
    const merged = { ...plan, ...patch };
    if (merged.original_price !== null && merged.original_price < merged.price) {
      throw new BadRequestException('original_price must not be lower than price.');
    }
    return this.plans.save(merged);
  }

  // Plans with purchase history are deactivated instead of deleted.
  async deletePlan(id: string) {
    const plan = UUID.test(id || '') ? await this.plans.findOne({ where: { id } }) : null;
    if (!plan) throw new NotFoundException('Plan not found.');
    if (await this.subs.exist({ where: { plan_id: plan.id } })) {
      plan.is_active = false;
      await this.plans.save(plan);
      return { deleted: false, deactivated: true };
    }
    await this.plans.delete({ id: plan.id });
    return { deleted: true };
  }

  // ─── Student side ─────────────────────────────────────────────────────────
  async mine(studentId: string) {
    const [user, subs] = await Promise.all([
      this.users.findOne({ where: { id: studentId } }),
      this.subs.find({ where: { student_id: studentId }, order: { created_at: 'DESC' }, take: 50 }),
    ]);
    return {
      referral: user ? await this.referrals.preview(user) : null,
      validity_start: dateOnly(user?.validity_start),
      validity_end: dateOnly(user?.validity_end),
      subscriptions: subs.map((s) => this.view(s)),
    };
  }

  async request(studentId: string, planId: string, note: unknown, referralCode?: unknown) {
    const student = await this.users.findOne({ where: { id: studentId } });
    if (!student || student.role !== UserRole.STUDENT) throw new ForbiddenException('Only students can request a plan.');
    const plan = UUID.test(planId || '') ? await this.plans.findOne({ where: { id: planId, is_active: true } }) : null;
    if (!plan) throw new NotFoundException('Plan not found.');
    const pending = await this.subs.find({ where: { student_id: studentId, status: 'Requested' } });
    if (pending.some((s) => s.plan_id === plan.id)) throw new BadRequestException('You have already requested this plan. The institute will activate it after payment.');
    if (pending.length >= MAX_PENDING) throw new BadRequestException(`You can have at most ${MAX_PENDING} pending requests.`);
    const text = String(note ?? '').trim();
    if (text.length > 300) throw new BadRequestException('Note must be at most 300 characters.');
    const ref = await this.referrals.discountForRequest(student, referralCode);
    const sub = await this.subs.save(this.subs.create({
      student_id: studentId, plan_id: plan.id, plan_name: plan.name, plan_price: plan.price,
      duration_days: plan.duration_days, status: 'Requested', student_note: text || null,
      referrer_id: ref.referrer_id, discount_pct: ref.discount_pct,
      discount_amount: Math.round((plan.price * ref.discount_pct) / 100),
    }));
    return this.view(sub);
  }

  async cancel(studentId: string, id: string) {
    const sub = UUID.test(id || '') ? await this.subs.findOne({ where: { id, student_id: studentId } }) : null;
    if (!sub) throw new NotFoundException('Request not found.');
    if (sub.status !== 'Requested') throw new BadRequestException('Only pending requests can be cancelled.');
    sub.status = 'Cancelled';
    return this.view(await this.subs.save(sub));
  }

  // ─── Staff side ───────────────────────────────────────────────────────────
  private view(s: PlanSubscription, student?: User) {
    const ends = dateOnly(s.ends_on);
    const display = s.status === 'Active' && ends && ends < today() ? 'Expired' : s.status;
    const out: any = { ...s, starts_on: dateOnly(s.starts_on), ends_on: ends, display_status: display };
    if (student) out.student = { name: student.name, user_id: student.user_id, phone: student.phone, status: student.status };
    return out;
  }

  async listSubscriptions() {
    const subs = await this.subs.find({ order: { created_at: 'DESC' } });
    const ids = [...new Set(subs.map((s) => s.student_id))];
    const users = ids.length ? await this.users.find({ where: { id: In(ids) } }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const rows = subs.map((s) => this.view(s, byId.get(s.student_id)));
    const t = today();
    const soon = addDays(t, 7);
    const monthStart = `${t.slice(0, 7)}-01`;
    const paid = rows.filter((r) => r.status === 'Active');
    return {
      overview: {
        total: paid.length,
        active: paid.filter((r) => r.display_status === 'Active').length,
        expiring_soon: paid.filter((r) => r.display_status === 'Active' && r.ends_on <= soon).length,
        expired: paid.filter((r) => r.display_status === 'Expired').length,
        pending: rows.filter((r) => r.status === 'Requested').length,
        revenue_total: paid.reduce((n, r) => n + (r.amount_paid || 0), 0),
        revenue_month: paid.filter((r) => r.activated_at && ymd(new Date(r.activated_at)) >= monthStart).reduce((n, r) => n + (r.amount_paid || 0), 0),
      },
      subscriptions: rows,
    };
  }

  private payment(body: any) {
    const amount = body?.amount_paid === undefined || body.amount_paid === '' || body.amount_paid === null ? null : Number(body.amount_paid);
    if (amount !== null && (!Number.isInteger(amount) || amount < 0 || amount > 1000000)) throw new BadRequestException('amount_paid must be a whole number of rupees.');
    const ref = String(body?.payment_ref ?? '').trim();
    if (ref.length > 100) throw new BadRequestException('payment_ref must be at most 100 characters.');
    const note = String(body?.admin_note ?? '').trim();
    if (note.length > 300) throw new BadRequestException('admin_note must be at most 300 characters.');
    return { amount_paid: amount, payment_ref: ref || null, admin_note: note || null };
  }

  // Activation: the new period starts today, or the day after the student's
  // current validity if that is still running (so renewals stack).
  private async activateTx(sub: PlanSubscription, staffId: string, pay: ReturnType<PlansService['payment']>) {
    return this.dataSource.transaction(async (m) => {
      const student = await m.findOne(User, { where: { id: sub.student_id }, lock: { mode: 'pessimistic_write' } });
      if (!student) throw new NotFoundException('Student not found.');
      const plan = await m.findOne(Plan, { where: { id: sub.plan_id } });
      const t = today();
      const currentEnd = dateOnly(student.validity_end);
      const starts = currentEnd && currentEnd >= t ? addDays(currentEnd, 1) : t;
      const ends = addDays(starts, sub.duration_days - 1);
      const userPatch: Partial<User> = { validity_end: ends as any };
      if (!student.validity_start || !currentEnd || currentEnd < t) userPatch.validity_start = starts as any;
      if (plan?.preload_tests_limit != null) userPatch.preload_tests_limit = plan.preload_tests_limit;
      if (plan?.steno_tests_limit != null) userPatch.steno_tests_limit = plan.steno_tests_limit;
      if (plan?.live_tests_limit != null) userPatch.live_tests_limit = plan.live_tests_limit;
      await m.update(User, { id: student.id }, userPatch);
      Object.assign(sub, pay, { status: 'Active', starts_on: starts, ends_on: ends, activated_at: new Date(), activated_by: staffId });
      const saved = await m.save(PlanSubscription, sub);
      // Refer & Earn: commission for the referrer on the student's first paid plan.
      const commission = await this.referrals.creditOnActivation(m, saved, student);
      return { ...this.view(saved, { ...student, ...userPatch } as User), referral_commission: commission ? commission.amount : 0 };
    });
  }

  async activate(staffId: string, id: string, body: any) {
    const sub = UUID.test(id || '') ? await this.subs.findOne({ where: { id } }) : null;
    if (!sub) throw new NotFoundException('Request not found.');
    if (sub.status !== 'Requested') throw new BadRequestException(`This request is already ${sub.status.toLowerCase()}.`);
    return this.activateTx(sub, staffId, this.payment(body));
  }

  async reject(id: string, body: any) {
    const sub = UUID.test(id || '') ? await this.subs.findOne({ where: { id } }) : null;
    if (!sub) throw new NotFoundException('Request not found.');
    if (sub.status !== 'Requested') throw new BadRequestException(`This request is already ${sub.status.toLowerCase()}.`);
    sub.status = 'Rejected';
    sub.admin_note = this.payment(body).admin_note;
    return this.view(await this.subs.save(sub));
  }

  // Staff assign a plan directly (payment taken at the counter, etc.).
  async assign(staffId: string, body: any) {
    const loginId = String(body?.student_user_id ?? '').trim();
    const student = loginId ? await this.users.findOne({ where: { user_id: loginId } }) : null;
    if (!student || student.role !== UserRole.STUDENT) throw new NotFoundException('No student with that login ID.');
    const plan = UUID.test(body?.plan_id || '') ? await this.plans.findOne({ where: { id: body.plan_id } }) : null;
    if (!plan) throw new NotFoundException('Plan not found.');
    const pay = this.payment(body);
    const sub = this.subs.create({
      student_id: student.id, plan_id: plan.id, plan_name: plan.name, plan_price: plan.price,
      duration_days: plan.duration_days, status: 'Requested',
    });
    return this.activateTx(sub, staffId, pay);
  }
}
