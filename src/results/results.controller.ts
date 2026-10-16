import { Controller, Get, Post, Delete, Body, Param, Query, Logger, BadRequestException, ForbiddenException, UseGuards, Request } from '@nestjs/common';
import { ResultsService } from './results.service';
import { Result } from '../entities/result.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

// Staff may read any student's results; a student only their own. Clients send
// either the UUID or the login ID (older sessions), so both count as "self".
const STAFF = [UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN];
const isStaff = (user: any) => STAFF.includes(user?.role);
const isSelf = (user: any, id?: string) => !!id && (id === user?.userId || id === user?.username);

@Controller('results')
export class ResultsController {
  private readonly logger = new Logger(ResultsController.name);

  constructor(private readonly resultsService: ResultsService) {}

  // Admin dashboard "Clear Results" action — deletes everything older than
  // `days` (default 10), keeping the most recent window of data.
  // Declared before the paged GET routes but as a distinct HTTP method
  // (DELETE), so it can't collide with the GET(':id') catch-all below.
  @Delete('cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async cleanup(@Query('days') days?: string): Promise<{ deleted: number }> {
    const retentionDays = Math.max(1, parseInt(days ?? '10', 10) || 10);
    const deleted = await this.resultsService.clearOldResults(retentionDays);
    this.logger.log(`DELETE /results/cleanup → removed ${deleted} row(s) older than ${retentionDays} day(s)`);
    return { deleted };
  }

  @Get('leaderboard')
  @UseGuards(JwtAuthGuard)
  getLeaderboard(
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any[]> {
    return this.resultsService.getLeaderboard(period, from, to);
  }

  @Get('rank')
  @UseGuards(JwtAuthGuard)
  getRank(
    @Request() req,
    @Query('chapterId') chapterId: string,
    @Query('studentId') studentId: string,
  ) {
    if (!isStaff(req.user) && !isSelf(req.user, studentId)) throw new ForbiddenException('You can only view your own rank.');
    return this.resultsService.getChapterRank(chapterId, studentId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async findByUser(@Request() req, @Param('userId') userId: string): Promise<Result[]> {
    if (!isStaff(req.user) && !isSelf(req.user, userId)) throw new ForbiddenException('You can only view your own results.');
    const rows = await this.resultsService.findByUser(userId);
    this.logger.log(`GET /results/user/${userId} → ${rows.length} row(s)`);
    return rows;
  }

  // Paged + filtered admin list: returns { rows, total } when ?page= is present.
  // pageSize=0 returns all matching rows (export). Without ?page=, falls back to
  // the legacy full-array response (?lean=1 for the dashboard's slim variant).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  findAll(
    @Query('lean') lean?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('course') course?: string,
    @Query('testType') testType?: string,
    @Query('examName') examName?: string,
  ): Promise<Result[] | { rows: Result[]; total: number }> {
    if (page !== undefined) {
      return this.resultsService.findPage({
        page: Math.max(1, parseInt(page, 10) || 1),
        pageSize: pageSize === undefined ? 25 : Math.max(0, parseInt(pageSize, 10) || 0),
        search, from, to, course, testType, examName,
      });
    }
    return this.resultsService.findAll(lean === '1' || lean === 'true');
  }

  // NOTE: keep this LAST among the GET routes — ':id' would otherwise swallow
  // the static paths above (leaderboard, rank, user/:userId).
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Request() req, @Param('id') id: string): Promise<Result | null> {
    const row = await this.resultsService.findOneFull(id);
    if (row && !isStaff(req.user) && row.student_id !== req.user.userId) throw new ForbiddenException('You can only view your own results.');
    // Never ship the credential hash to the client.
    if (row?.user) delete (row.user as any).password_hash;
    return row;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req, @Body() resultData: Partial<Result>): Promise<Result> {
    if (!resultData || typeof resultData !== 'object') throw new BadRequestException('Result data is required.');
    // A result is always saved for the logged-in user. A different student_id is
    // refused rather than rewritten, so a result queued offline under another
    // account on a shared PC waits until that student logs in again.
    if (resultData.student_id && !isSelf(req.user, resultData.student_id)) throw new ForbiddenException('Results can only be saved for your own account.');
    resultData.student_id = req.user.userId;
    // Never let a client pick the row id (save() would overwrite that result) or attach relations.
    delete (resultData as any).id;
    delete (resultData as any).user;
    delete (resultData as any).created_at;
    try {
      const saved = await this.resultsService.create(resultData);
      this.logger.log(`POST /results → saved id=${saved.id} student_id=${saved.student_id}`);
      return saved;
    } catch (err: any) {
      this.logger.error('POST /results failed: ' + (err?.message || err), err?.stack);
      throw new BadRequestException(err?.message || 'Failed to save result');
    }
  }
}
