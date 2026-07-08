import { Controller, Get, Post, Body, Param, Query, Logger, BadRequestException } from '@nestjs/common';
import { ResultsService } from './results.service';
import { Result } from '../entities/result.entity';

@Controller('results')
export class ResultsController {
  private readonly logger = new Logger(ResultsController.name);

  constructor(private readonly resultsService: ResultsService) {}

  @Get('leaderboard')
  getLeaderboard(
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any[]> {
    return this.resultsService.getLeaderboard(period, from, to);
  }

  @Get('rank')
  getRank(
    @Query('chapterId') chapterId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.resultsService.getChapterRank(chapterId, studentId);
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string): Promise<Result[]> {
    const rows = await this.resultsService.findByUser(userId);
    this.logger.log(`GET /results/user/${userId} → ${rows.length} row(s)`);
    return rows;
  }

  // Paged + filtered admin list: returns { rows, total } when ?page= is present.
  // pageSize=0 returns all matching rows (export). Without ?page=, falls back to
  // the legacy full-array response (?lean=1 for the dashboard's slim variant).
  @Get()
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
  async findOne(@Param('id') id: string): Promise<Result | null> {
    const row = await this.resultsService.findOneFull(id);
    // Never ship the credential hash to the client.
    if (row?.user) delete (row.user as any).password_hash;
    return row;
  }

  @Post()
  async create(@Body() resultData: Partial<Result>): Promise<Result> {
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
