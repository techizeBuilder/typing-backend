import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Lightweight self-healing schema sync.
 *
 * The app runs TypeORM with synchronize:false, so newly-added entity columns are
 * NOT created automatically — and because find() selects every mapped column, a
 * missing column breaks ALL queries for that table (list/create/update). This
 * service adds any such columns idempotently on startup so a deploy never leaves
 * the database out of sync. Each statement uses "ADD COLUMN IF NOT EXISTS", so it
 * is a no-op once the column exists.
 */
@Injectable()
export class SchemaSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SchemaSync');

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const statements = [
      // Hindi-Steno font configuration (chapters)
      `ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "language_type" varchar`,
      `ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "hindi_font_type" varchar`,
    ];

    for (const sql of statements) {
      try {
        await this.dataSource.query(sql);
      } catch (err) {
        this.logger.warn(`Schema sync statement failed (continuing): ${sql} — ${err?.message}`);
      }
    }
    this.logger.log('Schema sync complete — chapter font columns ensured.');
  }
}
