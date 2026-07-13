import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result } from '../entities/result.entity';
import { User } from '../entities/user.entity';
import { SettingsService } from '../settings/settings.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ResultsService implements OnModuleInit {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    @InjectRepository(Result)
    private resultsRepository: Repository<Result>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly settingsService: SettingsService,
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

    // Indexes for the hot lookup paths: per-student history, per-chapter ranks,
    // and the date-ordered admin list / leaderboard date filters.
    try {
      await this.resultsRepository.query(
        `CREATE INDEX IF NOT EXISTS idx_results_student_id ON results (student_id)`,
      );
      await this.resultsRepository.query(
        `CREATE INDEX IF NOT EXISTS idx_results_chapter_id ON results (chapter_id)`,
      );
      await this.resultsRepository.query(
        `CREATE INDEX IF NOT EXISTS idx_results_date_taken ON results (date_taken DESC)`,
      );
    } catch (err) {
      this.logger.warn(`Could not ensure results indexes: ${err?.message || err}`);
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
      // 'chapter' is loaded so the result screen can show the full uploaded passage
      // (content_text) as the "Original Passage", not just the trimmed reference_words.
      relations: ['exam', 'chapter'],
      order: { date_taken: 'DESC' },
    });
  }

  // lean=true returns only the tiny per-row fields the admin DASHBOARD aggregates
  // (counts + stored nwpm by date). No relations, no raw grading data. The full
  // (non-lean) variant is kept for backward compatibility but is very heavy —
  // page through findPage() instead.
  findAll(lean = false): Promise<Result[]> {
    if (lean) {
      return this.resultsRepository
        .createQueryBuilder('result')
        .select(['result.id', 'result.nwpm', 'result.mode', 'result.test_type', 'result.date_taken'])
        .orderBy('result.date_taken', 'DESC')
        .getMany();
    }
    return this.resultsRepository.find({
      relations: ['exam', 'user', 'chapter'],
      order: { date_taken: 'DESC' },
    });
  }

  // Paged + filtered admin results list. The raw grading fields (user_input,
  // reference_words, word_statuses, pattern_data) stay included because the admin
  // table re-derives NWPM/GWPM/accuracy from them (frontend resultMetrics.js) —
  // but only for one page of rows at a time, and the joined relations are trimmed
  // to the handful of fields the table shows (no chapter passage, no password hash).
  // pageSize <= 0 returns ALL matching rows (used by the export buttons).
  async findPage(opts: {
    page: number;
    pageSize: number;
    search?: string;
    from?: string;
    to?: string;
    course?: string;
    testType?: string;
    examName?: string;
  }): Promise<{ rows: Result[]; total: number }> {
    const qb = this.resultsRepository.createQueryBuilder('result')
      .leftJoin('result.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.user_id', 'user.category'])
      .leftJoin('result.exam', 'exam')
      .addSelect(['exam.id', 'exam.name', 'exam.test_time_minutes'])
      .leftJoin('result.chapter', 'chapter')
      .addSelect(['chapter.id', 'chapter.chapter_no'])
      .orderBy('result.date_taken', 'DESC');

    if (opts.search) {
      qb.andWhere('(user.name ILIKE :search OR user.user_id ILIKE :search)', {
        search: `%${opts.search}%`,
      });
    }
    if (opts.from) {
      const start = new Date(opts.from);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('result.date_taken >= :from', { from: start });
    }
    if (opts.to) {
      const end = new Date(opts.to);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('result.date_taken <= :to', { to: end });
    }
    if (opts.course) qb.andWhere('user.category = :course', { course: opts.course });
    if (opts.testType) qb.andWhere('result.test_type = :testType', { testType: opts.testType });
    if (opts.examName === 'Practice') {
      qb.andWhere('result.exam_id IS NULL');
    } else if (opts.examName) {
      qb.andWhere('exam.name = :examName', { examName: opts.examName });
    }

    const total = await qb.getCount();
    if (opts.pageSize > 0) {
      qb.skip(Math.max(0, opts.page - 1) * opts.pageSize).take(opts.pageSize);
    }
    return { rows: await qb.getMany(), total };
  }

  // Full single-result detail (including the chapter's complete passage text)
  // for the admin "View" action — fetched on demand instead of shipping it for
  // every row in the list.
  findOneFull(id: string): Promise<Result | null> {
    return this.resultsRepository.findOne({
      where: { id },
      relations: ['exam', 'user', 'chapter'],
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

  // Deletes result rows older than `retentionDays`, keeping the most recent
  // window of data. Used by the admin dashboard's "Clear Results" button.
  async clearOldResults(retentionDays = 10): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const result = await this.resultsRepository
      .createQueryBuilder()
      .delete()
      .from(Result)
      .where('date_taken < :cutoff', { cutoff })
      .execute();
    const deleted = result.affected || 0;
    this.logger.log(`Cleared ${deleted} result(s) older than ${retentionDays} day(s) (cutoff=${cutoff.toISOString()})`);
    return deleted;
  }

  async getLeaderboard(period?: string, from?: string, to?: string): Promise<any[]> {
    // Return all Live Test results with exam name; frontend handles dedup + filter + top-N
    // and the participant count. period === 'today' restricts to results recorded today
    // (used by the admin "Top Performer of the Day" leaderboard); from/to restrict to an
    // admin-selected date range.
    const qb = this.resultsRepository.createQueryBuilder('result')
      .select('users.name', 'username')
      .addSelect('users.user_id', 'user_id')
      .addSelect('result.nwpm', 'max_nwpm')
      .addSelect('result.gwpm', 'max_gwpm')
      .addSelect('result.accuracy', 'max_accuracy')
      .addSelect('exams.name', 'exam_name')
      .addSelect('result.date_taken', 'date_taken')
      .innerJoin('users', 'users', 'users.id = result.student_id')
      .innerJoin('chapters', 'chapters', 'chapters.id = result.chapter_id')
      .leftJoin('exams', 'exams', 'exams.id = result.exam_id')
      .where('chapters.test_type = :testType', { testType: 'Live Test' });

    if (from || to) {
      // Admin date-range filter. `from`/`to` are YYYY-MM-DD; include the whole `to` day.
      // The leaderboard only shows data up to the current date, so a `to` in the
      // future is capped at the end of today.
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        qb.andWhere('result.date_taken >= :start', { start });
      }
      let end = endOfToday;
      if (to) {
        end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (end > endOfToday) end = endOfToday;
      }
      qb.andWhere('result.date_taken <= :end', { end });
    } else if (period === 'today') {
      // Admin "Top Performer of the Day" — live, un-gated view of today's results.
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      qb.andWhere('result.date_taken >= :start AND result.date_taken < :end', { start, end });
    } else {
      // Student-facing leaderboard: rankings are PUBLISHED in daily batches at the
      // admin-configured rank-update time (default 9:00 PM). Results recorded after
      // the most recent update time stay pending until the next one passes, so the
      // ranking "updates automatically" each day at the configured time.
      //
      // Each publish covers ONLY that single calendar day's results — from midnight
      // of the published day up to the publish moment. Without the lower bound, every
      // prior day's results would bleed into the current day's ranking and inflate the
      // participant count, so we constrain to [startOfPublishedDay, cutoff].
      const cutoff = await this.settingsService.getLiveRankPublishedCutoff();
      const dayStart = new Date(cutoff);
      dayStart.setHours(0, 0, 0, 0);
      qb.andWhere('result.date_taken >= :dayStart AND result.date_taken <= :cutoff', { dayStart, cutoff });
    }

    return qb.orderBy('result.nwpm', 'DESC').getRawMany();
  }
}
