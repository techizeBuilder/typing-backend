-- ─────────────────────────────────────────────────────────────────────────────
-- Add Hindi-Steno font configuration to chapters.
--
-- The app runs TypeORM with synchronize:false, so new entity columns are NOT
-- auto-created. Run this once against the active database (typing_master) before
-- deploying the updated backend, e.g.:
--
--   psql -h <DB_HOST> -U <DB_USERNAME> -d typing_master -f 2026-06-add-steno-font-columns.sql
--
-- Both columns are nullable, so existing chapters are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- 'English' | 'Hindi' — typing language (primarily for Steno chapters)
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS language_type VARCHAR;

-- 'Mangal' | 'KrutiDev' | 'RemingtonGail' — Hindi font standard for Steno Hindi
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS hindi_font_type VARCHAR;
