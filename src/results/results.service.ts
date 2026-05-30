import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result } from '../entities/result.entity';
import { User } from '../entities/user.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ResultsService implements OnModuleInit {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    @InjectRepository(Result)
    private resultsRepository: Repository<Result>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // Ensure the test_type column exists (added so we can show Live test
    // results separately on the student "My Results" page).
    try {
      await this.resultsRepository.query(
        `ALTER TABLE results ADD COLUMN IF NOT EXISTS test_type VARCHAR`,
      );
      // Backfill existing rows by inheriting the chapter's test_type when possible.
      await this.resultsRepository.query(
        `UPDATE results r
         SET test_type = c.test_type
         FROM chapters c
         WHERE r.chapter_id = c.id AND r.test_type IS NULL`,
      );
    } catch (err) {
      this.logger.warn(`Could not ensure results.test_type column: ${err?.message || err}`);
    }
  }

  // Accept either a UUID (student_id) OR the human-readable login id (user_id).
  // If the parameter doesn't look like a UUID, look up the user by user_id first
  // and use their UUID for the result query. This keeps the endpoint resilient
  // to clients that still send the old (non-UUID) identifier from cached sessions.
  async findByUser(idOrLoginId: string): Promise<Result[]> {
    let uuid = idOrLoginId;
    if (!UUID_RE.test(idOrLoginId)) {
      const user = await this.usersRepository.findOne({ where: { user_id: idOrLoginId } });
      if (!user) return [];
      uuid = user.id;
    }
    return this.resultsRepository.find({
      where: { student_id: uuid },
      relations: ['exam'],
      order: { date_taken: 'DESC' },
    });
  }

  findAll(): Promise<Result[]> {
    return this.resultsRepository.find({
      relations: ['exam', 'user', 'chapter'],
      order: { date_taken: 'DESC' },
    });
  }

  async create(resultData: Partial<Result>): Promise<Result> {
    // If the client supplied a non-UUID student_id (e.g. the login user_id from
    // an outdated session), translate it to the real UUID before insert so the
    // row doesn't fail the uuid column constraint.
    if (resultData.student_id && !UUID_RE.test(resultData.student_id)) {
      const user = await this.usersRepository.findOne({ where: { user_id: resultData.student_id } });
      if (user) resultData.student_id = user.id;
    }

    // Sanitize numeric fields so a bad/edge-case calculation client-side
    // (e.g. accuracy of -1900% when mistakes >> words) doesn't trigger a
    // "numeric field overflow" on the accuracy decimal(5,2) column.
    const clampInt = (n: any, min: number, max: number, fallback: number) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return fallback;
      return Math.max(min, Math.min(max, Math.round(v)));
    };
    if (resultData.accuracy !== undefined && resultData.accuracy !== null) {
      const v = Number(resultData.accuracy);
      resultData.accuracy = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
    }
    if (resultData.gwpm !== undefined) resultData.gwpm = clampInt(resultData.gwpm, 0, 100000, 0);
    if (resultData.nwpm !== undefined) resultData.nwpm = clampInt(resultData.nwpm, 0, 100000, 0);
    if (resultData.total_errors !== undefined) resultData.total_errors = clampInt(resultData.total_errors, 0, 1000000, 0);
    if (resultData.full_errors !== undefined) resultData.full_errors = clampInt(resultData.full_errors, 0, 1000000, 0);
    if (resultData.half_errors !== undefined) resultData.half_errors = clampInt(resultData.half_errors, 0, 1000000, 0);
    if (resultData.total_strokes !== undefined) resultData.total_strokes = clampInt(resultData.total_strokes, 0, 10000000, 0);
    if (resultData.time_elapsed !== undefined) resultData.time_elapsed = clampInt(resultData.time_elapsed, 0, 86400, 0);

    const result = this.resultsRepository.create(resultData);
    return this.resultsRepository.save(result);
  }

  // Rank of a specific student inside a chapter's leaderboard, ranked by
  // best NWPM (tie-broken by accuracy desc, then earliest date).
  async getChapterRank(chapterId: string, studentId: string): Promise<{ rank: number | null; total: number; best: Result | null }> {
    if (!chapterId || !studentId) return { rank: null, total: 0, best: null };
    let uuid = studentId;
    if (!UUID_RE.test(studentId)) {
      const user = await this.usersRepository.findOne({ where: { user_id: studentId } });
      if (!user) return { rank: null, total: 0, best: null };
      uuid = user.id;
    }
    const rows = await this.resultsRepository.find({
      where: { chapter_id: chapterId },
      relations: ['exam'],
      order: { date_taken: 'ASC' },
    });
    if (rows.length === 0) return { rank: null, total: 0, best: null };
    // Reduce to one best row per student
    const bestByStudent = new Map<string, Result>();
    for (const r of rows) {
      const cur = bestByStudent.get(r.student_id);
      if (!cur) { bestByStudent.set(r.student_id, r); continue; }
      const better =
        Number(r.nwpm) > Number(cur.nwpm) ||
        (Number(r.nwpm) === Number(cur.nwpm) && Number(r.accuracy) > Number(cur.accuracy));
      if (better) bestByStudent.set(r.student_id, r);
    }
    const ranked = Array.from(bestByStudent.values()).sort((a, b) => {
      if (Number(b.nwpm) !== Number(a.nwpm)) return Number(b.nwpm) - Number(a.nwpm);
      if (Number(b.accuracy) !== Number(a.accuracy)) return Number(b.accuracy) - Number(a.accuracy);
      return new Date(a.date_taken).getTime() - new Date(b.date_taken).getTime();
    });
    const idx = ranked.findIndex(r => r.student_id === uuid);
    const best = idx >= 0 ? ranked[idx] : null;
    return {
      rank: idx >= 0 ? idx + 1 : null,
      total: ranked.length,
      best,
    };
  }

  async getLeaderboard(): Promise<any[]> {
    // Return all Live Test results with exam name; frontend handles dedup + filter + top-10
    return this.resultsRepository.createQueryBuilder('result')
      .select('users.name', 'username')
      .addSelect('result.nwpm', 'max_nwpm')
      .addSelect('result.gwpm', 'max_gwpm')
      .addSelect('result.accuracy', 'max_accuracy')
      .addSelect('exams.name', 'exam_name')
      .innerJoin('users', 'users', 'users.id = result.student_id')
      .innerJoin('chapters', 'chapters', 'chapters.id = result.chapter_id')
      .leftJoin('exams', 'exams', 'exams.id = result.exam_id')
      .where('chapters.test_type = :testType', { testType: 'Live Test' })
      .orderBy('result.nwpm', 'DESC')
      .getRawMany();
  }
}
