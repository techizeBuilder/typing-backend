import { Module } from '@nestjs/common';
import { AdminSummaryController } from './admin-summary.controller';

@Module({ controllers: [AdminSummaryController] })
export class AdminSummaryModule {}
