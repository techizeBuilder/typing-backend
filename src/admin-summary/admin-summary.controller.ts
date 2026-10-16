import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

// Counts for the admin frame (sidebar "System Summary" and the notification bell).
// One round trip of COUNT queries; nothing personal is returned.
@Controller('admin/summary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminSummaryController {
  constructor(private readonly dataSource: DataSource) {}

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
}
