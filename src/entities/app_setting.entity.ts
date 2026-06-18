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
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.LIVE_RANK_UPDATE_TIME]: '21:00', // 9:00 PM
};
