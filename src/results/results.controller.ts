import { Controller, Get, Post, Body, Param, Query, Logger, BadRequestException } from '@nestjs/common';
import { ResultsService } from './results.service';
import { Result } from '../entities/result.entity';

@Controller('results')
export class ResultsController {
  private readonly logger = new Logger(ResultsController.name);

  constructor(private readonly resultsService: ResultsService) {}

  @Get('leaderboard')
  getLeaderboard(): Promise<any[]> {
    return this.resultsService.getLeaderboard();
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

  @Get()
  findAll(): Promise<Result[]> {
    return this.resultsService.findAll();
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
