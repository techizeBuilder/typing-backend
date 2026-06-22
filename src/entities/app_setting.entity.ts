import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Generic key/value store for global admin settings (e.g. the live-test rank
// update time). Kept as a flat key/value table so new settings can be added
// without a schema migration.
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column('text')
  value: string;

  @UpdateDateColumn()
  updated_at: Date;
}

// Well-known setting keys + defaults.
export const SETTING_KEYS = {
  // Time of day (24h "HH:MM") at which live-test rankings are published/refreshed.
  LIVE_RANK_UPDATE_TIME: 'live_rank_update_time',
  // Desktop application download (managed from the Admin Panel).
  DESKTOP_APP_URL: 'desktop_app_url',           // relative path, e.g. /uploads/desktop/<file>.exe
  DESKTOP_APP_FILENAME: 'desktop_app_filename', // original .exe filename for the download
  DESKTOP_APP_VERSION: 'desktop_app_version',   // e.g. 1.2.0
  DESKTOP_APP_RELEASE_DATE: 'desktop_app_release_date', // ISO date, e.g. 2026-06-22
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.LIVE_RANK_UPDATE_TIME]: '21:00', // 9:00 PM
  [SETTING_KEYS.DESKTOP_APP_URL]: '',
  [SETTING_KEYS.DESKTOP_APP_FILENAME]: '',
  [SETTING_KEYS.DESKTOP_APP_VERSION]: '',
  [SETTING_KEYS.DESKTOP_APP_RELEASE_DATE]: '',
};
