import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting, SETTING_DEFAULTS, SETTING_KEYS } from '../entities/app_setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepository: Repository<AppSetting>,
  ) {}

  async onModuleInit() {
    // TypeORM synchronize is off, so create the table manually (idempotent).
    try {
      await this.settingsRepository.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key VARCHAR PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      this.logger.log('Ensured app_settings table exists.');
    } catch (err: any) {
      this.logger.warn(`Could not ensure app_settings table: ${err?.message || err}`);
    }

    // Seed defaults for any missing well-known keys.
    for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
      try {
        await this.settingsRepository.query(
          `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
          [key, value],
        );
      } catch (err: any) {
        this.logger.warn(`Could not seed setting "${key}": ${err?.message || err}`);
      }
    }
  }

  /** Returns every setting as a plain { key: value } object, merged over defaults. */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.settingsRepository.find();
    const out: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  /** Returns a single setting's value, falling back to its default (or '') when unset. */
  async get(key: string): Promise<string> {
    const row = await this.settingsRepository.findOneBy({ key });
    return row?.value ?? SETTING_DEFAULTS[key] ?? '';
  }

  /** Creates or updates a setting and returns the stored value. */
  async set(key: string, value: string): Promise<{ key: string; value: string }> {
    await this.settingsRepository.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
    return { key, value };
  }

  /**
   * The most recent moment the live-test rankings were (re)published, based on the
   * configured daily update time. Results recorded AFTER this moment are still
   * "pending" and must not appear in the published leaderboard until the next
   * update time passes. Returns the latest past occurrence of HH:MM.
   */
  async getLiveRankPublishedCutoff(now: Date = new Date()): Promise<Date> {
    const raw = await this.get(SETTING_KEYS.LIVE_RANK_UPDATE_TIME);
    const m = /^(\d{1,2}):(\d{2})$/.exec((raw || '').trim());
    const hh = m ? Math.min(23, parseInt(m[1], 10)) : 21;
    const mm = m ? Math.min(59, parseInt(m[2], 10)) : 0;

    const cutoff = new Date(now);
    cutoff.setHours(hh, mm, 0, 0);
    // If today's update time hasn't passed yet, the last publish was yesterday's.
    if (cutoff.getTime() > now.getTime()) {
      cutoff.setDate(cutoff.getDate() - 1);
    }
    return cutoff;
  }
}
