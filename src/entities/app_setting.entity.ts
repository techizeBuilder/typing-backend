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
  // Desktop application download — an EXTERNAL URL (e.g. a Google Drive share link)
  // configured from the Admin Panel. No installer files are stored on the server.
  DESKTOP_APP_URL: 'desktop_app_url',                   // e.g. https://drive.google.com/...
  DESKTOP_APP_VERSION: 'desktop_app_version',           // e.g. 1.2.0 (optional, for display)
  DESKTOP_APP_RELEASE_DATE: 'desktop_app_release_date', // ISO date, e.g. 2026-06-22 (optional)
  // Mobile application download — same model: an external URL + optional metadata.
  MOBILE_APP_URL: 'mobile_app_url',                     // e.g. https://drive.google.com/...
  MOBILE_APP_VERSION: 'mobile_app_version',
  MOBILE_APP_RELEASE_DATE: 'mobile_app_release_date',
  // Institute branding shown on downloaded PDFs/passages (and available for any other
  // student-facing screen that wants it via GET /settings).
  INSTITUTE_NAME: 'institute_name',
  INSTITUTE_LOGO_URL: 'institute_logo_url',             // relative path, e.g. /uploads/settings/xxxx.png
  // Admin-designed exam screen ("Screen 7 — Institute Layout"), JSON; see common/screen-layout.ts.
  SCREEN_LAYOUT: 'screen_layout',
  // How students pay for a plan (manual activation): shown on the Plan & Pricing page.
  PLANS_CONTACT_PHONE: 'plans_contact_phone',
  PLANS_CONTACT_WHATSAPP: 'plans_contact_whatsapp',
  PLANS_PAYMENT_NOTE: 'plans_payment_note',
  // Refer & Earn
  REFERRAL_ENABLED: 'referral_enabled',
  REFERRAL_COMMISSION_PCT: 'referral_commission_pct',
  REFERRAL_PREMIUM_COMMISSION_PCT: 'referral_premium_commission_pct',
  REFERRAL_DISCOUNT_PCT: 'referral_discount_pct',
  REFERRAL_MIN_PAYOUT: 'referral_min_payout',
  // AI Deep Analysis (needs ANTHROPIC_API_KEY in the backend .env)
  AI_ANALYSIS_ENABLED: 'ai_analysis_enabled',
  AI_DAILY_LIMIT: 'ai_daily_limit',
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.LIVE_RANK_UPDATE_TIME]: '21:00', // 9:00 PM
  [SETTING_KEYS.DESKTOP_APP_URL]: '',
  [SETTING_KEYS.DESKTOP_APP_VERSION]: '',
  [SETTING_KEYS.DESKTOP_APP_RELEASE_DATE]: '',
  [SETTING_KEYS.MOBILE_APP_URL]: '',
  [SETTING_KEYS.MOBILE_APP_VERSION]: '',
  [SETTING_KEYS.MOBILE_APP_RELEASE_DATE]: '',
  [SETTING_KEYS.INSTITUTE_NAME]: '',
  [SETTING_KEYS.INSTITUTE_LOGO_URL]: '',
  [SETTING_KEYS.SCREEN_LAYOUT]: '',
  [SETTING_KEYS.PLANS_CONTACT_PHONE]: '',
  [SETTING_KEYS.PLANS_CONTACT_WHATSAPP]: '',
  [SETTING_KEYS.PLANS_PAYMENT_NOTE]: '',
  [SETTING_KEYS.REFERRAL_ENABLED]: 'true',
  [SETTING_KEYS.REFERRAL_COMMISSION_PCT]: '10',
  [SETTING_KEYS.REFERRAL_PREMIUM_COMMISSION_PCT]: '15',
  [SETTING_KEYS.REFERRAL_DISCOUNT_PCT]: '10',
  [SETTING_KEYS.REFERRAL_MIN_PAYOUT]: '100',
  [SETTING_KEYS.AI_ANALYSIS_ENABLED]: 'true',
  [SETTING_KEYS.AI_DAILY_LIMIT]: '5',
};
