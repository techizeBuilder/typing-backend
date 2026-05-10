import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResultPatternsService } from './result-patterns.service';
import { ResultPatternsController } from './result-patterns.controller';
import { ResultPattern } from '../entities/result_pattern.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResultPattern])],
  controllers: [ResultPatternsController],
  providers: [ResultPatternsService],
  exports: [ResultPatternsService],
})
export class ResultPatternsModule {}
