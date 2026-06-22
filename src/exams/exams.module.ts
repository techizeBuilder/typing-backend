import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { Exam } from '../entities/exam.entity';
import { Chapter } from '../entities/chapter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Exam, Chapter])],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
