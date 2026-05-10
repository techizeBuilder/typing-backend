import {
  Controller, Get, Post, Put, Delete,
  Body, Query, Param, UseGuards,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ChaptersService } from './chapters.service';
import { Chapter, FontGroup } from '../entities/chapter.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

const audioStorage = diskStorage({
  destination: join(__dirname, '..', '..', 'uploads', 'steno-audio'),
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
