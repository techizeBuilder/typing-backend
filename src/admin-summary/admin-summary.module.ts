import { Module } from '@nestjs/common';
import { AdminSummaryController } from './admin-summary.controller';
import { ResultsModule } from '../results/results.module';

@Module({ imports: [ResultsModule], controllers: [AdminSummaryController] })
export class AdminSummaryModule {}
