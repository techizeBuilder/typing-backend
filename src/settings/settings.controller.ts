import { Controller, Get, Put, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SETTING_KEYS } from '../entities/app_setting.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // Public read so student-facing screens (e.g. the leaderboard) can show the
  // configured rank-update time.
  @Get()
  getAll() {
    return this.service.getAll();
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
    // Validate the rank-update time is a 24h HH:MM string.
    if (key === SETTING_KEYS.LIVE_RANK_UPDATE_TIME && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim())) {
      throw new BadRequestException('Time must be in 24-hour HH:MM format (e.g. 21:00)');
    }
    return this.service.set(key, value.trim());
  }
}
