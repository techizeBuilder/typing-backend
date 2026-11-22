import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { computeResultMetrics } from './result-metrics';
import { UserRole } from '../entities/user.entity';

const REF = 'Now Sir the Bill was introduced in the House of the People today'.split(' ');
const steno = (over: any = {}) => ({
  id: 'r1', student_id: 'stu', chapter_id: 'ch', mode: 'Steno English', reference_words: REF, word_statuses: [],
  user_input: REF.join(' '), full_errors: 0, half_errors: 0, total_strokes: 60, time_elapsed: 600,
  gwpm: 12, nwpm: 12, accuracy: 100, date_taken: new Date('2026-11-01T05:00:00Z'),
  pattern_data: { required_accuracy: 95, required_speed: 35 }, exam: null, ...over,
});

function service(rows: any[] = []) {
  const deleted: string[] = [];
  const resultsRepo: any = {
    findOne: async ({ where }: any) => rows.find((r) => r.id === where.id) || null,
    find: async ({ where }: any) => rows.filter((r) => r.chapter_id === where.chapter_id),
    delete: async (id: string) => { deleted.push(id); },
    manager: { query: async () => [] },
  };
  const usersRepo: any = { findOne: async () => null };
  return { svc: new ResultsService(resultsRepo, usersRepo, {} as any), deleted };
}

describe('steno result deletion', () => {
  it('a student deletes their own attempt below 30%', async () => {
    const { svc, deleted } = service([steno({ full_errors: 12 })]);
    await svc.deleteLowScoreSteno('r1', { userId: 'stu', staff: false });
    expect(deleted).toEqual(['r1']);
  });
  it('refuses attempts at 30% or above', async () => {
    const { svc } = service([steno({ full_errors: 9 })]);   // 9/13 = 69.2% mistakes → 30.8% accuracy
    await expect(svc.deleteLowScoreSteno('r1', { userId: 'stu', staff: false })).rejects.toThrow(BadRequestException);
  });
  it('refuses another student’s attempt; admins may delete it', async () => {
    const { svc, deleted } = service([steno({ full_errors: 13 })]);
    await expect(svc.deleteLowScoreSteno('r1', { userId: 'other', staff: false })).rejects.toThrow(ForbiddenException);
    await svc.deleteLowScoreSteno('r1', { userId: 'admin', staff: true });
    expect(deleted).toEqual(['r1']);
  });
  it('refuses typing results and unknown ids', async () => {
    const { svc } = service([steno({ mode: 'English Typing', word_statuses: REF.map(() => 'error'), full_errors: 13 })]);
    await expect(svc.deleteLowScoreSteno('r1', { userId: 'stu', staff: false })).rejects.toThrow(BadRequestException);
    await expect(svc.deleteLowScoreSteno('nope', { userId: 'stu', staff: true })).rejects.toThrow(NotFoundException);
  });
  it('uses the stored pattern: a lenient half-mistake rule keeps a result', async () => {
    // 8 half mistakes = 4 counted (30.8% mistakes → 69% accuracy) with half = 0.5, but 61.5% with half = 1
    const lenient = service([steno({ half_errors: 8, pattern_data: { half_mistake_enabled: true } })]);
    await expect(lenient.svc.deleteLowScoreSteno('r1', { userId: 'stu', staff: false })).rejects.toThrow(BadRequestException);
  });
});

describe('dictation rank', () => {
  it('steno ranks on % first, one best attempt per student', async () => {
    const rows = [
      steno({ id: 'a1', student_id: '11111111-1111-4111-8111-111111111111', full_errors: 2, nwpm: 90 }),
      steno({ id: 'a2', student_id: '11111111-1111-4111-8111-111111111111', full_errors: 6, nwpm: 99 }),
      steno({ id: 'b1', student_id: '22222222-2222-4222-8222-222222222222', full_errors: 1, nwpm: 10 }),
    ];
    const { svc } = service(rows);
    const a = await svc.getChapterRank('ch', '11111111-1111-4111-8111-111111111111');
    expect(a).toMatchObject({ rank: 2, total: 2 });
    expect(a.best?.id).toBe('a1');
    const b = await svc.getChapterRank('ch', '22222222-2222-4222-8222-222222222222');
    expect(b.rank).toBe(1);
  });
  it('no rank without chapter or rows', async () => {
    const { svc } = service([]);
    expect(await svc.getChapterRank('', 'x')).toMatchObject({ rank: null, total: 0 });
    expect(await svc.getChapterRank('ch', '11111111-1111-4111-8111-111111111111')).toMatchObject({ rank: null });
  });
});

describe('results controller access rules', () => {
  const svc: any = {
    getChapterRank: jest.fn(async () => ({ rank: 1 })),
    findByUser: jest.fn(async () => []),
    findOneFull: jest.fn(async () => ({ id: 'r', student_id: 'stu', user: { password_hash: 'h' } })),
    create: jest.fn(async (d: any) => ({ id: 'new', ...d })),
    deleteLowScoreSteno: jest.fn(async () => undefined),
  };
  const ctl = new ResultsController(svc);
  const student = { user: { userId: 'stu', username: 'login1', role: UserRole.STUDENT } };
  const admin = { user: { userId: 'adm', role: UserRole.ADMIN } };
  const sub = { user: { userId: 'sub', role: UserRole.SUBADMIN } };

  it('students only see their own rank and results', async () => {
    expect(() => ctl.getRank(student, 'ch', 'someone-else')).toThrow(ForbiddenException);
    await expect(ctl.getRank(student, 'ch', 'login1')).resolves.toBeDefined();
    await expect(ctl.findByUser(student, 'someone-else')).rejects.toThrow(ForbiddenException);
    await expect(ctl.findByUser(admin, 'anyone')).resolves.toEqual([]);
  });
  it('a result never ships its user’s password hash', async () => {
    const row: any = await ctl.findOne(student, 'r');
    expect(row.user.password_hash).toBeUndefined();
    await expect(ctl.findOne({ user: { userId: 'x', role: UserRole.STUDENT } }, 'r')).rejects.toThrow(ForbiddenException);
  });
  it('a result is always saved for the logged-in student', async () => {
    const saved: any = await ctl.create(student, { gwpm: 1, id: 'forced', user: { id: 'x' } } as any);
    expect(saved.student_id).toBe('stu');
    expect(svc.create.mock.calls[0][0].id).toBeUndefined();
    await expect(ctl.create(student, { student_id: 'other' } as any)).rejects.toThrow(ForbiddenException);
    await expect(ctl.create(student, null as any)).rejects.toThrow(BadRequestException);
  });
  it('sub-admins cannot delete results', async () => {
    await expect(ctl.remove(sub, 'r')).rejects.toThrow(ForbiddenException);
    await expect(ctl.remove(admin, 'r')).resolves.toEqual({ deleted: true });
    expect(svc.deleteLowScoreSteno).toHaveBeenCalledWith('r', { userId: 'adm', staff: true });
  });
});

describe('server scoring copy', () => {
  it('honours the admin pattern (same as the app)', () => {
    const m = computeResultMetrics(steno({ full_errors: 1, pattern_data: { transposition_mistake: 'full', transpositions: 1, required_accuracy: 80 } }));
    expect(m.fullErrors).toBe(2);
    expect(m.mistakePercent).toBe(15.38);
    expect(m.qualified).toBe(true);
  });
});
