import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultPattern } from '../entities/result_pattern.entity';

@Injectable()
export class ResultPatternsService {
  constructor(
    @InjectRepository(ResultPattern)
    private readonly patternRepository: Repository<ResultPattern>,
  ) {}

  findAll(): Promise<ResultPattern[]> {
    return this.patternRepository.find();
  }

  findOne(id: string): Promise<ResultPattern | null> {
    return this.patternRepository.findOneBy({ id });
  }

  create(patternData: Partial<ResultPattern>): Promise<ResultPattern> {
    const pattern = this.patternRepository.create(patternData);
    return this.patternRepository.save(pattern);
  }

  async update(id: string, patternData: Partial<ResultPattern>): Promise<any> {
    await this.patternRepository.update(id, patternData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<any> {
    return this.patternRepository.delete(id);
  }
}
