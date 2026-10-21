import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
          ignorable_mistakes_enabled BOOLEAN NOT NULL DEFAULT false,
          ignorable_mistakes_percent FLOAT NOT NULL DEFAULT 0,
          ignorable_penalty_words_per_mistake FLOAT NOT NULL DEFAULT 10,
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
          count_omissions_as_errors BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      this.logger.log('Ensured result_patterns table exists.');
    } catch (err) {
      this.logger.warn(`Could not ensure result_patterns table: ${err?.message || err}`);
    }

    // Add count_omissions_as_errors column for existing tables that predate this feature
    try {
      await this.patternRepository.query(
        `ALTER TABLE result_patterns ADD COLUMN IF NOT EXISTS count_omissions_as_errors BOOLEAN NOT NULL DEFAULT true`,
      );
    } catch (err) {
      this.logger.warn(`Could not add count_omissions_as_errors column: ${err?.message || err}`);
    }

    // Add ignorable_mistakes_percent column for existing tables that predate this feature
    try {
      await this.patternRepository.query(
        `ALTER TABLE result_patterns ADD COLUMN IF NOT EXISTS ignorable_mistakes_percent FLOAT NOT NULL DEFAULT 0`,
      );
    } catch (err) {
      this.logger.warn(`Could not add ignorable_mistakes_percent column: ${err?.message || err}`);
    }

    // Add ignorable_mistakes_enabled column for existing tables that predate this feature
    try {
      await this.patternRepository.query(
        `ALTER TABLE result_patterns ADD COLUMN IF NOT EXISTS ignorable_mistakes_enabled BOOLEAN NOT NULL DEFAULT false`,
      );
    } catch (err) {
      this.logger.warn(`Could not add ignorable_mistakes_enabled column: ${err?.message || err}`);
    }

    // Add ignorable_penalty_words_per_mistake column for existing tables that predate this feature
    try {
      await this.patternRepository.query(
        `ALTER TABLE result_patterns ADD COLUMN IF NOT EXISTS ignorable_penalty_words_per_mistake FLOAT NOT NULL DEFAULT 10`,
      );
    } catch (err) {
      this.logger.warn(`Could not add ignorable_penalty_words_per_mistake column: ${err?.message || err}`);
    }
  }

  findAll(): Promise<ResultPattern[]> {
    return this.patternRepository.find();
  }

  findOne(id: string): Promise<ResultPattern | null> {
    return this.patternRepository.findOneBy({ id });
  }

  async create(patternData: Partial<ResultPattern>): Promise<ResultPattern> {
    const data = this.cleanInfo(patternData, false);
    const pattern = await this.patternRepository.save(this.patternRepository.create(data));
    if (pattern.is_default) await this.clearOtherDefaults(pattern.id);
    return pattern;
  }

  async update(id: string, patternData: Partial<ResultPattern>): Promise<any> {
    const data = this.cleanInfo(patternData, true);
    if (Object.keys(data).length) await this.patternRepository.update(id, data);
    if (data.is_default) await this.clearOtherDefaults(id);
    return this.findOne(id);
  }

  private async clearOtherDefaults(keepId: string) {
    await this.patternRepository.createQueryBuilder().update().set({ is_default: false })
      .where('id != :keepId AND is_default = true', { keepId }).execute();
  }

  // Validates the information / timing fields. The scoring fields pass through
  // untouched, exactly as before.
  private cleanInfo(body: any, partial: boolean): Partial<ResultPattern> {
    const { id, created_at, updated_at, ...data } = body || {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (has('description')) {
      const d = data.description == null ? '' : String(data.description).trim();
      if (d.length > 500) throw new BadRequestException('Description must be at most 500 characters.');
      data.description = d || null;
    }
    for (const k of ['applicable_typing', 'applicable_steno', 'is_default']) {
      if (has(k)) data[k] = data[k] === true || data[k] === 'true';
    }
    if ((has('applicable_typing') || has('applicable_steno') || !partial) && data.applicable_typing === false && data.applicable_steno === false) {
      throw new BadRequestException('Choose at least one of Typing Exam or Steno Exam under Applicable For.');
    }
    for (const k of ['live_result_mode', 'preload_result_mode']) {
      if (has(k) && !['immediate', 'scheduled'].includes(data[k])) throw new BadRequestException(`${k} must be immediate or scheduled.`);
    }
    for (const k of ['live_result_time', 'preload_result_time']) {
      if (has(k) && !time.test(String(data[k] || ''))) throw new BadRequestException('Result time must be in 24-hour HH:MM format (e.g. 21:00).');
    }
    if (has('live_rank_mode') && !['immediate', 'after_session'].includes(data.live_rank_mode)) {
      throw new BadRequestException('live_rank_mode must be immediate or after_session.');
    }
    return data;
  }

  async remove(id: string): Promise<any> {
    return this.patternRepository.delete(id);
  }
}
