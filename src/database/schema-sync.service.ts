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
      // Total word count for a dictation/passage (auto-calculated, editable)
      `ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "word_count" integer`,
      // Per-result mode (e.g. "Steno English") so the student "My Results" page
      // can separate Typing vs Steno reports. Backfilled from the chapter's
      // font_group for legacy rows that pre-date this column.
      `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "mode" varchar`,
      `UPDATE results r SET mode = c.font_group
         FROM chapters c
         WHERE r.chapter_id = c.id AND (r.mode IS NULL OR r.mode = '')`,
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
      // Exam extras: region filter, official rules PDF, test difficulty
      `ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "region" varchar(40)`,
      `ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "rules_pdf_url" varchar`,
      `ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "difficulty" varchar(20)`,
      // Support tickets (student help requests) and their conversation
      `CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ticket_no" SERIAL,
        "student_id" uuid NOT NULL,
        "subject" varchar(200) NOT NULL,
        "category" varchar(60) NOT NULL DEFAULT 'Other',
        "priority" varchar(20) NOT NULL DEFAULT 'Medium',
        "status" varchar(20) NOT NULL DEFAULT 'Open',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_support_tickets_student" ON "support_tickets" ("student_id")`,
      `CREATE TABLE IF NOT EXISTS "support_replies" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
        "author_id" uuid NOT NULL,
        "author_type" varchar(20) NOT NULL,
        "author_name" varchar(200),
        "message" text NOT NULL,
        "attachments" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_support_replies_ticket" ON "support_replies" ("ticket_id")`,
      // Student reviews (one per student; approved ones show on the landing page)
      `CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL UNIQUE,
        "rating" integer NOT NULL,
        "exam" varchar(150) NOT NULL,
        "designation" varchar(150),
        "message" text NOT NULL,
        "photo_url" varchar,
        "status" varchar(20) NOT NULL DEFAULT 'Pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_reviews_status" ON "reviews" ("status")`,
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
