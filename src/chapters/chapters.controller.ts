import {
  Controller, Get, Post, Put, Delete,
  Body, Query, Param, Res, UseGuards,
  UploadedFile, UseInterceptors, BadRequestException, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { createReadStream, existsSync } from 'fs';
import type { Response } from 'express';
import { ChaptersService } from './chapters.service';
import { Chapter, FontGroup } from '../entities/chapter.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

// Nest compiles src/ → dist/src/, so controller lives at dist/src/chapters/
// Go up THREE levels to reach backend root, then into uploads/steno-audio/
const STENO_AUDIO_DIR = join(__dirname, '..', '..', '..', 'uploads', 'steno-audio');

const audioStorage = diskStorage({
  destination: (_req, _file, cb) => {
    // Create directory if it doesn't exist (safety net)
    const fs = require('fs');
    fs.mkdirSync(STENO_AUDIO_DIR, { recursive: true });
    cb(null, STENO_AUDIO_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `steno-${unique}${extname(file.originalname)}`);
  },
});

@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  findAll(
    @Query('fontGroup') fontGroup: FontGroup,
    @Query('testType') testType: string,
    @Query('examId') examId: string,
  ): Promise<Chapter[]> {
    return this.chaptersService.findFiltered(fontGroup, testType, examId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  create(@Body() chapterData: Partial<Chapter>): Promise<Chapter> {
    return this.chaptersService.create(chapterData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  update(@Param('id') id: string, @Body() chapterData: Partial<Chapter>): Promise<any> {
    return this.chaptersService.update(id, chapterData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  remove(@Param('id') id: string): Promise<any> {
    return this.chaptersService.remove(id);
  }

  /** Stream steno audio file for a chapter — works through any proxy */
  @Get(':id/audio')
  async streamAudio(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const chapter = await this.chaptersService.findOne(id);
    if (!chapter?.audio_url) throw new NotFoundException('No audio for this chapter');

    // audio_url is stored as  /uploads/steno-audio/filename.mp3
    // __dirname (compiled) = .../backend/dist/src/chapters → go up 3 to backend root
    const relativePath = chapter.audio_url.replace(/^\//, '');
    const audioPath = join(__dirname, '..', '..', '..', relativePath);

    if (!existsSync(audioPath)) {
      throw new NotFoundException(`Audio file not found on server: ${relativePath}`);
    }

    const ext = audioPath.split('.').pop()?.toLowerCase();
    const mime = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
    res.set({ 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
    return new StreamableFile(createReadStream(audioPath));
  }

  /** Upload / replace steno audio for a chapter */
  @Post(':id/audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('audio', { storage: audioStorage }))
  async uploadAudio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No audio file uploaded');
    const audioUrl = `/uploads/steno-audio/${file.filename}`;
    await this.chaptersService.update(id, { audio_url: audioUrl });
    return { audio_url: audioUrl };
  }
}
