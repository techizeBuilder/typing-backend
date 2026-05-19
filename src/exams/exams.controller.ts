import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Logger, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ExamsService } from './exams.service';
import { Exam } from '../entities/exam.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('exams')
export class ExamsController {
  private readonly logger = new Logger(ExamsController.name);

  constructor(
    private readonly examsService: ExamsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  findAll(): Promise<Exam[]> {
    return this.examsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/exams',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  create(@Body() examData: any, @UploadedFile() file: Express.Multer.File): Promise<Exam> {
    if (file) {
      // Store only relative path so the frontend can prepend the correct base URL
      examData.image_url = `/uploads/exams/${file.filename}`;
    }
    // Convert stringified numbers back (FormData sends everything as strings)
    const numFields = ['test_time_minutes', 'font_size_user_screen', 'font_size_test_screen', 'max_words_strokes', 'no_of_words_strokes'];
    numFields.forEach(field => {
       if (examData[field] !== undefined) {
          examData[field] = parseInt(examData[field], 10);
          if (isNaN(examData[field])) examData[field] = 0;
       }
    });

    // Convert booleans
    const boolFields = ['highlight_word', 'highlight_error', 'auto_scroll', 'auto_submit', 'test_re_type'];
    boolFields.forEach(field => {
       if (examData[field] !== undefined) {
         examData[field] = (examData[field] === 'true' || examData[field] === true);
       }
    });

    // Parse font_groups JSON string from FormData
    if (examData.font_groups) {
      try {
        examData.font_groups = typeof examData.font_groups === 'string'
          ? JSON.parse(examData.font_groups)
          : examData.font_groups;
      } catch { examData.font_groups = [examData.font_groups]; }
    }
    // Keep legacy font_group in sync with first selected group
    if (Array.isArray(examData.font_groups) && examData.font_groups.length > 0) {
      examData.font_group = examData.font_groups[0];
    }

    // Fix foreign key relation logic for TypeORM mapping
    const patternId = examData.result_pattern || examData.result_pattern_id;
    if (patternId && typeof patternId === 'string' && patternId.trim() !== '') {
        examData.result_pattern = { id: patternId };
    } else {
        examData.result_pattern = null;
    }
    delete examData.result_pattern_id; // remove unmapped simple column to avoid crash
    delete examData.image; // remove the raw image file string if it ended up in body

    return this.examsService.create(examData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/exams',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async update(@Param('id') id: string, @Body() examData: any, @UploadedFile() file: Express.Multer.File): Promise<any> {
    if (file) {
      examData.image_url = `/uploads/exams/${file.filename}`;
    }
    
    // Convert stringified numbers back
    const numFields = ['test_time_minutes', 'font_size_user_screen', 'font_size_test_screen', 'max_words_strokes', 'no_of_words_strokes'];
    numFields.forEach(field => {
       if (examData[field] !== undefined) {
          examData[field] = parseInt(examData[field], 10);
          if (isNaN(examData[field])) examData[field] = 0;
       }
    });

    // Convert booleans
    const boolFields = ['highlight_word', 'highlight_error', 'auto_scroll', 'auto_submit', 'test_re_type'];
    boolFields.forEach(field => {
       if (examData[field] !== undefined) {
         examData[field] = (examData[field] === 'true' || examData[field] === true);
       }
    });

    // Parse font_groups JSON string from FormData
    if (examData.font_groups) {
      try {
        examData.font_groups = typeof examData.font_groups === 'string'
          ? JSON.parse(examData.font_groups)
          : examData.font_groups;
      } catch { examData.font_groups = [examData.font_groups]; }
    }
    if (Array.isArray(examData.font_groups) && examData.font_groups.length > 0) {
      examData.font_group = examData.font_groups[0];
    }

    // Fix foreign key relation logic for TypeORM mapping
    const patternId = examData.result_pattern || examData.result_pattern_id;
    if (patternId && typeof patternId === 'string' && patternId.trim() !== '') {
        examData.result_pattern = { id: patternId };
    } else {
        examData.result_pattern = null;
    }
    delete examData.result_pattern_id; // remove unmapped simple column to avoid crash
    delete examData.image; // remove the raw image file string if it ended up in body

    return this.examsService.update(id, examData);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Exam | null> {
    return this.examsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  remove(@Param('id') id: string): Promise<any> {
    return this.examsService.remove(id);
  }
}
