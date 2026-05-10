import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ResultsService } from './results.service';
import { Result } from '../entities/result.entity';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('leaderboard')
  getLeaderboard(): Promise<any[]> {
    return this.resultsService.getLeaderboard();
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string): Promise<Result[]> {
    return this.resultsService.findByUser(userId);
  }

  @Get()
  findAll(): Promise<Result[]> {
    return this.resultsService.findAll();
  }

  @Post()
  create(@Body() resultData: Partial<Result>): Promise<Result> {
    return this.resultsService.create(resultData);
  }
}
