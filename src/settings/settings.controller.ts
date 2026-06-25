import { Controller, Get, Put, Body, Param, Res, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SETTING_KEYS } from '../entities/app_setting.entity';

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

  @Get(':key')
  async getOne(@Param('key') key: string) {
    return { key, value: await this.service.get(key) };
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async update(@Param('key') key: string, @Body('value') value: string) {
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
    return this.service.set(key, trimmed);
  }
}
