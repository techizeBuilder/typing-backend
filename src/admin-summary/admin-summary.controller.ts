import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ResultsService } from '../results/results.service';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Counts for the admin frame (sidebar "System Summary" and the notification bell)
// and the admin dashboard. Nothing personal is returned except the top-5 names.
@Controller('admin/summary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminSummaryController {
  constructor(private readonly dataSource: DataSource, private readonly resultsService: ResultsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async summary() {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'Student')::int AS students,
        (SELECT COUNT(*) FROM users WHERE role = 'Student' AND status = 'Active' AND (validity_end IS NULL OR validity_end >= now()))::int AS active_students,
        (SELECT COUNT(*) FROM users WHERE role = 'Student' AND status = 'Pending')::int AS pending_students,
        (SELECT COUNT(*) FROM users WHERE role = 'Student' AND (status = 'Inactive' OR validity_end < now()))::int AS inactive_students,
        (SELECT COUNT(*) FROM exams)::int AS exams,
        (SELECT COUNT(*) FROM chapters WHERE font_group::text NOT LIKE 'Steno%')::int AS typing_tests,
        (SELECT COUNT(*) FROM chapters WHERE font_group::text LIKE 'Steno%')::int AS steno_tests,
        (SELECT COUNT(*) FROM chapters WHERE test_type = 'Live Test')::int AS live_tests,
        (SELECT COUNT(*) FROM chapters WHERE test_type <> 'Live Test')::int AS preload_tests,
        (SELECT COUNT(*) FROM results)::int AS results,
        (SELECT COUNT(*) FROM support_tickets WHERE status = 'Open')::int AS open_tickets,
        (SELECT COUNT(*) FROM plan_subscriptions WHERE status = 'Requested')::int AS purchase_requests,
        (SELECT COUNT(*) FROM reviews WHERE status = 'Pending')::int AS pending_reviews
    `);
    return row;
  }

  // Dashboard: period results (same scoring as the Results page), test counts by
  // language, 30-day activity, recent tests/exams and the top 5 students (30 days).
  @Get('dashboard')
  // Staff could already open the dashboard (it showed these figures before).
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async dashboard(@Query('period') period?: string) {
    const now = new Date();
    let start = new Date(now);
    if (period === 'weekly') start.setDate(now.getDate() - 7);
    else if (period === 'monthly') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'yearly') start = new Date(now.getFullYear(), 0, 1);
    // daily (default) → today
    const from = ymd(start); const to = ymd(now);
    const stats = await this.resultsService.stats({ from, to });

    const [tests] = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE font_group::text = 'English Typing')::int AS typing_english,
        COUNT(*) FILTER (WHERE font_group::text IN ('Hindi Mangal', 'Hindi Kruti Dev', 'Hindi Remington (GAIL)'))::int AS typing_hindi,
        COUNT(*) FILTER (WHERE font_group::text = 'Steno English')::int AS steno_english,
        COUNT(*) FILTER (WHERE font_group::text = 'Steno Hindi')::int AS steno_hindi
      FROM chapters`);

    // Last 30 days (server dates).
    const activity = await this.dataSource.query(`
      WITH days AS (SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day')::date AS d)
      SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'Student' AND u.created_at::date = days.d)::int AS new_students,
        (SELECT COUNT(*) FROM results r WHERE r.date_taken::date = days.d)::int AS tests,
        (SELECT COUNT(DISTINCT r.student_id) FROM results r WHERE r.date_taken::date = days.d)::int AS active_students
      FROM days ORDER BY days.d`);

    const recentTests = await this.dataSource.query(`
      SELECT id, chapter_no, name, font_group::text AS font_group, test_type, difficulty, is_active, created_at
      FROM chapters ORDER BY created_at DESC LIMIT 5`);
    const recentExams = await this.dataSource.query(`
      SELECT e.id, e.name, e.display_title, e.is_active, e.created_at,
        (SELECT COUNT(*) FROM chapters c WHERE c.exam_id = e.id OR (',' || COALESCE(c.exam_ids, '') || ',') LIKE '%,' || e.id || ',%')::int AS tests,
        (SELECT COUNT(DISTINCT r.student_id) FROM results r WHERE r.exam_id = e.id)::int AS students
      FROM exams e ORDER BY e.created_at DESC LIMIT 5`);

    const top = await this.resultsService.adminLeaderboard({ from: ymd(new Date(now.getTime() - 29 * 86400000)), to, limit: 5 });

    return {
      period: { from, to },
      results: { total: stats.total, avg_nwpm: stats.avg_nwpm, avg_gwpm: stats.avg_gwpm, avg_accuracy: stats.avg_accuracy, qualified: stats.qualified },
      tests,
      activity,
      recent_tests: recentTests,
      recent_exams: recentExams,
      top_students: top.top.map((r: any) => ({ rank: r.rank, name: r.name, user_id: r.user_id, exam_name: r.exam_name, nwpm: r.nwpm, accuracy: r.accuracy })),
    };
  }
}
