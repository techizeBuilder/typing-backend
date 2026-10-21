import { Controller, Get, Post, Put, Body, Param, Res, Request, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, hasModule } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SETTING_KEYS } from '../entities/app_setting.entity';
import { sanitizeScreenLayout } from '../common/screen-layout';

// Settings are Admin-only, except the payment and Refer & Earn settings on the
// Subscription & Plan page, which Sub-Admins with that module may change.
const PLAN_SETTING_KEYS: string[] = [
  SETTING_KEYS.PLANS_CONTACT_PHONE, SETTING_KEYS.PLANS_CONTACT_WHATSAPP, SETTING_KEYS.PLANS_PAYMENT_NOTE,
  SETTING_KEYS.REFERRAL_ENABLED, SETTING_KEYS.REFERRAL_COMMISSION_PCT, SETTING_KEYS.REFERRAL_PREMIUM_COMMISSION_PCT,
  SETTING_KEYS.REFERRAL_DISCOUNT_PCT, SETTING_KEYS.REFERRAL_MIN_PAYOUT,
];

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // Public read so student-facing screens (e.g. the leaderboard and the landing
  // page download buttons) can read configuration like the rank-update time and
  // the current desktop/mobile app download URLs.
  @Get()
  getAll() {
    return this.service.getAll();
  }

  // Public: 302-redirect to the admin-configured external desktop download URL
  // (e.g. a Google Drive link). Kept as a stable backend route so the link the
  // landing page points at never changes even when the target URL does. Returns
  // 404 until an admin configures the URL.
  @Get('desktop-app/download')
  async downloadDesktopApp(@Res() res: Response) {
    const url = await this.service.get(SETTING_KEYS.DESKTOP_APP_URL);
    if (!url) throw new NotFoundException('No desktop application download link has been configured yet.');
    return res.redirect(302, url);
  }

  // Public: 302-redirect to the admin-configured external mobile download URL.
  @Get('mobile-app/download')
  async downloadMobileApp(@Res() res: Response) {
    const url = await this.service.get(SETTING_KEYS.MOBILE_APP_URL);
    if (!url) throw new NotFoundException('No mobile application download link has been configured yet.');
    return res.redirect(302, url);
  }

  // Institute logo upload for branding the downloaded PDF/passage documents. Returns the
  // relative URL; the admin panel then saves it via PUT /settings/institute_logo_url so the
  // key/value store stays the single source of truth (same two-step flow as exam images).
  @Post('institute-logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const path = './uploads/settings';
        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        cb(null, path);
      },
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  uploadInstituteLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No logo file was uploaded.');
    return { url: `/uploads/settings/${file.filename}` };
  }

  @Get(':key')
  async getOne(@Param('key') key: string) {
    return { key, value: await this.service.get(key) };
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async update(@Request() req, @Param('key') key: string, @Body('value') value: string) {
    if (req.user.role === UserRole.SUBADMIN && !(PLAN_SETTING_KEYS.includes(key) && hasModule(req.user, 'plans'))) {
      throw new ForbiddenException('Only an Admin can change this setting.');
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('value (string) is required');
    }
    const trimmed = value.trim();
    // Validate the rank-update time is a 24h HH:MM string.
    if (key === SETTING_KEYS.LIVE_RANK_UPDATE_TIME && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      throw new BadRequestException('Time must be in 24-hour HH:MM format (e.g. 21:00)');
    }
    // App download links must be absolute http(s) URLs when provided (empty clears them).
    if ((key === SETTING_KEYS.DESKTOP_APP_URL || key === SETTING_KEYS.MOBILE_APP_URL) && trimmed) {
      if (!/^https?:\/\/.+/i.test(trimmed)) {
        throw new BadRequestException('Download URL must start with http:// or https://');
      }
    }
    // Plan contact numbers: digits with optional + / spaces / dashes.
    if ((key === SETTING_KEYS.PLANS_CONTACT_PHONE || key === SETTING_KEYS.PLANS_CONTACT_WHATSAPP) && trimmed && !/^\+?[\d\s-]{7,20}$/.test(trimmed)) {
      throw new BadRequestException('Enter a valid phone number (digits, optional +).');
    }
    if (key === SETTING_KEYS.PLANS_PAYMENT_NOTE && trimmed.length > 500) {
      throw new BadRequestException('Payment instructions must be at most 500 characters.');
    }
    // Refer & Earn settings.
    if (key === SETTING_KEYS.REFERRAL_ENABLED && !['true', 'false'].includes(trimmed)) {
      throw new BadRequestException('referral_enabled must be true or false.');
    }
    const pctKeys: string[] = [SETTING_KEYS.REFERRAL_COMMISSION_PCT, SETTING_KEYS.REFERRAL_PREMIUM_COMMISSION_PCT, SETTING_KEYS.REFERRAL_DISCOUNT_PCT];
    if (pctKeys.includes(key) && !(/^\d{1,2}$/.test(trimmed) && Number(trimmed) <= 50)) {
      throw new BadRequestException('Percentages must be whole numbers from 0 to 50.');
    }
    if (key === SETTING_KEYS.REFERRAL_MIN_PAYOUT && !(/^\d{1,6}$/.test(trimmed) && Number(trimmed) >= 1)) {
      throw new BadRequestException('Minimum payout must be a whole number of rupees (at least 1).');
    }
    // AI Deep Analysis settings.
    if (key === SETTING_KEYS.AI_ANALYSIS_ENABLED && !['true', 'false'].includes(trimmed)) {
      throw new BadRequestException('ai_analysis_enabled must be true or false.');
    }
    if (key === SETTING_KEYS.AI_DAILY_LIMIT && !(/^\d{1,3}$/.test(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= 100)) {
      throw new BadRequestException('Daily AI analyses per student must be a whole number from 1 to 100.');
    }
    // Backup schedule settings.
    if (key === SETTING_KEYS.BACKUP_SCHEDULE_ENABLED && !['true', 'false'].includes(trimmed)) {
      throw new BadRequestException('backup_schedule_enabled must be true or false.');
    }
    if (key === SETTING_KEYS.BACKUP_TIME && !/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      throw new BadRequestException('Backup time must be in 24-hour HH:MM format (e.g. 02:00).');
    }
    if (key === SETTING_KEYS.BACKUP_KEEP && !(/^\d{1,3}$/.test(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= 90)) {
      throw new BadRequestException('Backups to keep must be a whole number from 1 to 90.');
    }
    // Social channel links: absolute http(s) URLs when provided (empty hides the card).
    if ((key === SETTING_KEYS.TELEGRAM_URL || key === SETTING_KEYS.YOUTUBE_URL) && trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
      throw new BadRequestException('Channel link must start with http:// or https://');
    }
    // Policy pages (plain text) and Contact Us details.
    const pageKeys: string[] = [SETTING_KEYS.PAGE_TERMS, SETTING_KEYS.PAGE_PRIVACY, SETTING_KEYS.PAGE_REFUND];
    if (pageKeys.includes(key) && trimmed.length > 20000) {
      throw new BadRequestException('Page text must be at most 20,000 characters.');
    }
    if (key === SETTING_KEYS.CONTACT_PHONE && trimmed && !/^\+?[\d\s-]{7,20}$/.test(trimmed)) {
      throw new BadRequestException('Enter a valid phone number (digits, optional +).');
    }
    if (key === SETTING_KEYS.CONTACT_EMAIL && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    if (key === SETTING_KEYS.CONTACT_ADDRESS && trimmed.length > 500) {
      throw new BadRequestException('Address must be at most 500 characters.');
    }
    if (key === SETTING_KEYS.CONTACT_HOURS && trimmed.length > 200) {
      throw new BadRequestException('Office hours must be at most 200 characters.');
    }
    // Screen layout is structured JSON: validate and normalise it.
    if (key === SETTING_KEYS.SCREEN_LAYOUT) {
      return this.service.set(key, sanitizeScreenLayout(trimmed));
    }
    return this.service.set(key, trimmed);
  }
}
