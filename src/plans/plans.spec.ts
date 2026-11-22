import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { ReferralsService } from '../referrals/referrals.service';
import { User, UserRole } from '../entities/user.entity';
import { Plan, PlanSubscription } from '../entities/plan.entity';
import { addDays, zonedDate } from '../common/zoned-time';

const SUB_ID = '11111111-1111-4111-8111-111111111111';
const today = zonedDate(new Date());

function setup({ student, plan = { id: 'p', preload_tests_limit: 20 }, referrer = null as any, earlierPaid = false, settings = {} as any }) {
  const userUpdates: any[] = [];
  const saved: any[] = [];
  const m: any = {
    findOne: async (entity: any, { where }: any) => (entity === User ? (where.id === student.id ? student : referrer) : entity === Plan ? plan : null),
    update: async (_e: any, _w: any, patch: any) => { userUpdates.push(patch); },
    save: async (_e: any, row: any) => { saved.push(row); return row; },
    exists: async () => earlierPaid,
    create: (_e: any, row: any) => row,
  };
  const dataSource: any = { transaction: (cb: any) => cb(m) };
  const values: Record<string, string> = { referral_enabled: 'true', referral_discount_pct: '10', referral_commission_pct: '10', referral_premium_commission_pct: '15', referral_min_payout: '100', ...settings };
  const settingsSvc: any = { getAll: async () => values, get: async (k: string) => values[k] ?? '' };
  const subs: any = { findOne: async ({ where }: any) => (where.id === SUB_ID ? { id: SUB_ID, student_id: student.id, plan_id: 'p', status: 'Requested', duration_days: 30, plan_name: 'Gold' } : null), exist: async () => earlierPaid, save: async (r: any) => r };
  const referrals = new ReferralsService({} as any, subs, {} as any, {} as any, settingsSvc);
  const svc = new PlansService({} as any, subs, {} as any, dataSource, referrals);
  return { svc, userUpdates, saved };
}

describe('plan activation dates (India calendar)', () => {
  it('a new plan starts today and lasts its duration', async () => {
    const { svc, userUpdates } = setup({ student: { id: 's', role: UserRole.STUDENT } });
    const r: any = await svc.activate('staff', SUB_ID, { amount_paid: 999 });
    expect(r.starts_on).toBe(today);
    expect(r.ends_on).toBe(addDays(today, 29));
    expect(userUpdates[0]).toMatchObject({ validity_start: today, validity_end: addDays(today, 29), preload_tests_limit: 20 });
  });
  it('a renewal stacks after the running validity', async () => {
    const end = addDays(today, 10);
    const { svc, userUpdates } = setup({ student: { id: 's', role: UserRole.STUDENT, validity_start: addDays(today, -20), validity_end: end } });
    const r: any = await svc.activate('staff', SUB_ID, {});
    expect(r.starts_on).toBe(addDays(end, 1));
    expect(userUpdates[0].validity_start).toBeUndefined();   // the running period keeps its start
  });
  it('an expired student starts again from today', async () => {
    const { svc } = setup({ student: { id: 's', role: UserRole.STUDENT, validity_start: '2020-01-01', validity_end: '2020-02-01' } });
    expect(((await svc.activate('staff', SUB_ID, {})) as any).starts_on).toBe(today);
  });
  it('rejects bad payments and unknown requests', async () => {
    const { svc } = setup({ student: { id: 's', role: UserRole.STUDENT } });
    await expect(svc.activate('staff', SUB_ID, { amount_paid: -5 })).rejects.toThrow(BadRequestException);
    await expect(svc.activate('staff', SUB_ID, { amount_paid: 10.5 })).rejects.toThrow(BadRequestException);
    await expect(svc.activate('staff', 'not-a-uuid', {})).rejects.toThrow(NotFoundException);
  });
});

describe('referral commission', () => {
  const premiumReferrer = { id: 'ref', role: UserRole.STUDENT, validity_end: '2999-01-01' };
  const freeReferrer = { id: 'ref', role: UserRole.STUDENT, validity_end: '2000-01-01' };
  it('pays the higher rate when the referrer has an active plan', async () => {
    const { svc, saved } = setup({ student: { id: 's', role: UserRole.STUDENT, referred_by: 'ref' }, referrer: premiumReferrer });
    const r: any = await svc.activate('staff', SUB_ID, { amount_paid: 1000 });
    expect(r.referral_commission).toBe(150);
    expect(saved.find((x) => x.rate)).toMatchObject({ rate: 15, amount: 150, base_amount: 1000 });
  });
  it('normal rate otherwise; nothing on a free activation or a second plan', async () => {
    expect(((await setup({ student: { id: 's', role: UserRole.STUDENT, referred_by: 'ref' }, referrer: freeReferrer }).svc.activate('staff', SUB_ID, { amount_paid: 1000 })) as any).referral_commission).toBe(100);
    expect(((await setup({ student: { id: 's', role: UserRole.STUDENT, referred_by: 'ref' }, referrer: freeReferrer }).svc.activate('staff', SUB_ID, {})) as any).referral_commission).toBe(0);
    expect(((await setup({ student: { id: 's', role: UserRole.STUDENT, referred_by: 'ref' }, referrer: freeReferrer, earlierPaid: true }).svc.activate('staff', SUB_ID, { amount_paid: 1000 })) as any).referral_commission).toBe(0);
  });
  it('nothing when Refer & Earn is switched off', async () => {
    const { svc } = setup({ student: { id: 's', role: UserRole.STUDENT, referred_by: 'ref' }, referrer: premiumReferrer, settings: { referral_enabled: 'false' } });
    expect(((await svc.activate('staff', SUB_ID, { amount_paid: 1000 })) as any).referral_commission).toBe(0);
  });
});

describe('payout requests', () => {
  const make = (balance: number, pending = false) => {
    const users: any = { findOne: async () => ({ id: 'u', role: UserRole.STUDENT }) };
    const commissions: any = { sum: async () => balance };
    const payouts: any = { exist: async () => pending, sum: async () => 0, save: async (r: any) => r, create: (r: any) => r };
    const settingsSvc: any = { getAll: async () => ({ referral_min_payout: '100' }), get: async () => '' };
    return new ReferralsService(users, {} as any, commissions, payouts, settingsSvc);
  };
  it('checks UPI, minimum, balance and one request at a time', async () => {
    await expect(make(500).requestPayout('u', { amount: 200, upi_id: 'bad' })).rejects.toThrow(BadRequestException);
    await expect(make(500).requestPayout('u', { amount: 50, upi_id: 'me@okaxis' })).rejects.toThrow(BadRequestException);
    await expect(make(150).requestPayout('u', { amount: 200, upi_id: 'me@okaxis' })).rejects.toThrow(BadRequestException);
    await expect(make(500, true).requestPayout('u', { amount: 200, upi_id: 'me@okaxis' })).rejects.toThrow(BadRequestException);
    await expect(make(500).requestPayout('u', { amount: 200, upi_id: 'me@okaxis' })).resolves.toMatchObject({ amount: 200, status: 'Requested' });
  });
});
