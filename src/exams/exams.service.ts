import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from '../entities/exam.entity';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam)
    private examsRepository: Repository<Exam>,
  ) {}

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
