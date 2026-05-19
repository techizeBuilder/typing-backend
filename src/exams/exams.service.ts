import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from '../entities/exam.entity';

@Injectable()
export class ExamsService implements OnModuleInit {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    @InjectRepository(Exam)
    private examsRepository: Repository<Exam>,
  ) {}

  async onModuleInit() {
    // Ensure font_groups column exists (added for multi-font-group assignment).
    // Safe to run repeatedly because of IF NOT EXISTS.
    try {
      await this.examsRepository.query(
        `ALTER TABLE exams ADD COLUMN IF NOT EXISTS font_groups TEXT`,
      );
      this.logger.log('Ensured exams.font_groups column exists.');
    } catch (err) {
      this.logger.warn(`Could not ensure exams.font_groups column: ${err?.message || err}`);
    }
  }

  findAll(): Promise<Exam[]> {
    return this.examsRepository.find({ relations: ['result_pattern'] });
  }

  findOne(id: string): Promise<Exam | null> {
    return this.examsRepository.findOneBy({ id });
  }

  async create(examData: Partial<Exam>): Promise<Exam> {
    const exam = this.examsRepository.create(examData);
    return this.examsRepository.save(exam);
  }

  async update(id: string, examData: Partial<Exam>): Promise<any> {
    return this.examsRepository.update(id, examData);
  }

  async remove(id: string): Promise<any> {
    return this.examsRepository.delete(id);
  }
}
