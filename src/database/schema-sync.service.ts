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
      // Admin-selected default Steno dictation speed (WPM)
      `ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "steno_speed" integer`,
      // Per-student test limits (users)
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "live_tests_limit" integer`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preload_tests_limit" integer`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "steno_tests_limit" integer`,
      // Staff / sub-admin columns (users). These were added to the entity for
      // staff management; ensure they exist on older databases.
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "designation" varchar`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" text`,
      // Staff (sub-admin) records legitimately have no student-only fields, so
      // these columns MUST be nullable. On older databases some were created
      // NOT NULL, which makes "create staff" fail with a not-null violation.
      // Dropping NOT NULL is idempotent and safe (it only loosens the column).
      `ALTER TABLE "users" ALTER COLUMN "category" DROP NOT NULL`,
      `ALTER TABLE "users" ALTER COLUMN "fathers_name" DROP NOT NULL`,
      `ALTER TABLE "users" ALTER COLUMN "city" DROP NOT NULL`,
      `ALTER TABLE "users" ALTER COLUMN "state" DROP NOT NULL`,
      `ALTER TABLE "users" ALTER COLUMN "roll_no" DROP NOT NULL`,
    ];

    for (const sql of statements) {
      try {
        await this.dataSource.query(sql);
      } catch (err) {
        this.logger.warn(`Schema sync statement failed (continuing): ${sql} — ${err?.message}`);
      }
    }
    this.logger.log('Schema sync complete — chapter font + user limit columns ensured.');
  }
}
