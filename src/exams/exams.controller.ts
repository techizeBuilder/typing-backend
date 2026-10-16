import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Logger, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { EXAM_REGIONS, normalizeChoice } from '../common/exam-extras';
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
import { cleanExamInfo } from '../common/management-fields';

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
    delete examData.rules_pdf_url;
    if (file) {
      // Store only relative path so the frontend can prepend the correct base URL
      examData.image_url = `/uploads/exams/${file.filename}`;
    }
    normalizeChoice(examData, 'region', EXAM_REGIONS);
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
    cleanExamInfo(examData);
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
    delete examData.rules_pdf_url;
    if (file) {
      examData.image_url = `/uploads/exams/${file.filename}`;
    }
    
    normalizeChoice(examData, 'region', EXAM_REGIONS);
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
    cleanExamInfo(examData);
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
    // Only touch the pattern when the request sends one: partial updates (e.g. the
    // Activate/Deactivate toggle sends just is_active) must not clear it.
    if ('result_pattern' in examData || 'result_pattern_id' in examData) {
      const patternId = examData.result_pattern || examData.result_pattern_id;
      if (patternId && typeof patternId === 'string' && patternId.trim() !== '') {
          examData.result_pattern = { id: patternId };
      } else {
          examData.result_pattern = null;
      }
    }
    delete examData.result_pattern_id; // remove unmapped simple column to avoid crash
    delete examData.image; // remove the raw image file string if it ended up in body

    return this.examsService.update(id, examData);
  }

  // Official rules / instructions PDF for an exam (max 10 MB). Replaces any previous file.
  @Post(':id/rules-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('pdf', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const path = './uploads/exam-rules';
        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        cb(null, path);
      },
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}.pdf`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') cb(null, true);
      else cb(new BadRequestException('Only PDF files can be uploaded.'), false);
    },
  }))
  async uploadRulesPdf(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No PDF uploaded.');
    const exam = await this.examsService.findOne(id);
    if (!exam) {
      fs.promises.unlink(file.path).catch(() => {});
      throw new BadRequestException('Exam not found.');
    }
    this.deleteRulesFile(exam.rules_pdf_url);
    const rules_pdf_url = `/uploads/exam-rules/${file.filename}`;
    await this.examsService.update(id, { rules_pdf_url });
    return { rules_pdf_url };
  }

  @Delete(':id/rules-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async removeRulesPdf(@Param('id') id: string) {
    const exam = await this.examsService.findOne(id);
    if (!exam) throw new BadRequestException('Exam not found.');
    this.deleteRulesFile(exam.rules_pdf_url);
    await this.examsService.update(id, { rules_pdf_url: null });
    return { rules_pdf_url: null };
  }

  private deleteRulesFile(url?: string | null) {
    if (url && url.startsWith('/uploads/exam-rules/')) fs.promises.unlink(join('.', url)).catch(() => {});
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Exam | null> {
    return this.examsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  remove(@Param('id') id: string, @Query('force') force?: string): Promise<any> {
    return this.examsService.remove(id, force === 'true');
  }
}
