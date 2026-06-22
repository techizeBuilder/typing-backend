import { Controller, Get, Post, Put, Body, Param, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SETTING_KEYS } from '../entities/app_setting.entity';

const DESKTOP_UPLOAD_DIR = './uploads/desktop';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // Public read so student-facing screens (e.g. the leaderboard and the landing
  // page download button) can read configuration like the rank-update time and
  // the current desktop-app version.
  @Get()
  getAll() {
    return this.service.getAll();
  }

  // Public: streams the current desktop .exe as an attachment so clicking the
  // landing-page button downloads the file directly (with its friendly name)
  // regardless of cross-origin static-asset rules.
  @Get('desktop-app/download')
  async downloadDesktopApp(@Res() res: Response) {
    const url = await this.service.get(SETTING_KEYS.DESKTOP_APP_URL);
    if (!url) throw new NotFoundException('No desktop application has been uploaded yet.');
    // url is stored as "/uploads/desktop/<file>" — resolve it to an absolute path.
    const absPath = join(process.cwd(), url.replace(/^\/+/, ''));
    if (!existsSync(absPath)) throw new NotFoundException('Desktop application file is missing.');
    const filename = (await this.service.get(SETTING_KEYS.DESKTOP_APP_FILENAME)) || basename(absPath);
    return res.download(absPath, filename);
  }

  // Admin: upload a new desktop .exe (and optional version / release date). This
  // replaces the "current" download advertised on the landing page so future
  // versions can be published without any code changes.
  @Post('desktop-app/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(DESKTOP_UPLOAD_DIR, { recursive: true });
        cb(null, DESKTOP_UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        // Timestamp-prefix a sanitized name so re-uploads never collide or get
        // served from a stale cache.
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${safe}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (extname(file.originalname).toLowerCase() !== '.exe') {
        return cb(new BadRequestException('Only .exe files are allowed.'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB ceiling for the installer
  }))
  async uploadDesktopApp(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { version?: string; release_date?: string },
  ) {
    if (!file) throw new BadRequestException('No .exe file uploaded.');
    const url = `/uploads/desktop/${file.filename}`;
    await this.service.set(SETTING_KEYS.DESKTOP_APP_URL, url);
    await this.service.set(SETTING_KEYS.DESKTOP_APP_FILENAME, file.originalname);
    await this.service.set(SETTING_KEYS.DESKTOP_APP_VERSION, (body?.version || '').trim());
    await this.service.set(
      SETTING_KEYS.DESKTOP_APP_RELEASE_DATE,
      (body?.release_date || '').trim() || new Date().toISOString().slice(0, 10),
    );
    return {
      url,
      filename: file.originalname,
      version: (body?.version || '').trim(),
      release_date: (body?.release_date || '').trim() || new Date().toISOString().slice(0, 10),
    };
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
