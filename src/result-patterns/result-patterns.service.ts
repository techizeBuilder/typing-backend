import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultPattern } from '../entities/result_pattern.entity';

@Injectable()
export class ResultPatternsService implements OnModuleInit {
  private readonly logger = new Logger(ResultPatternsService.name);

  constructor(
    @InjectRepository(ResultPattern)
    private readonly patternRepository: Repository<ResultPattern>,
  ) {}

  async onModuleInit() {
    // Create the result_patterns table if it does not exist yet.
    // TypeORM synchronize is off, so we handle this manually.
    try {
      await this.patternRepository.query(`
        CREATE TABLE IF NOT EXISTS result_patterns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR UNIQUE NOT NULL,
          speed_count VARCHAR NOT NULL DEFAULT 'Words',
          half_mistake_enabled BOOLEAN NOT NULL DEFAULT false,
          penalty_type VARCHAR NOT NULL DEFAULT 'Word',
          penalty_value FLOAT NOT NULL DEFAULT 1,
          count_right_words_only BOOLEAN NOT NULL DEFAULT false,
          qualify_on VARCHAR NOT NULL DEFAULT 'NWPM',
          required_speed FLOAT NOT NULL DEFAULT 35,
          required_accuracy FLOAT NOT NULL DEFAULT 95,
          show_half_mistakes BOOLEAN NOT NULL DEFAULT true,
          show_full_mistakes BOOLEAN NOT NULL DEFAULT true,
          show_total_strokes BOOLEAN NOT NULL DEFAULT true,
          show_total_words BOOLEAN NOT NULL DEFAULT true,
          show_total_errors BOOLEAN NOT NULL DEFAULT true,
          show_correct_words BOOLEAN NOT NULL DEFAULT true,
          show_gross_speed BOOLEAN NOT NULL DEFAULT true,
          show_net_speed BOOLEAN NOT NULL DEFAULT true,
          show_accuracy BOOLEAN NOT NULL DEFAULT true,
          show_penalty_words BOOLEAN NOT NULL DEFAULT true,
          show_ignorable_mistakes BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      this.logger.log('Ensured result_patterns table exists.');
    } catch (err) {
      this.logger.warn(`Could not ensure result_patterns table: ${err?.message || err}`);
    }
  }

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
