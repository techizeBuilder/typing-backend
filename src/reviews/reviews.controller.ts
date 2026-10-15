import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewsService } from './reviews.service';

const PHOTO_LIMIT = 2 * 1024 * 1024; // 2 MB

const photoUpload = FileInterceptor('photo', {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const path = './uploads/reviews';
      if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
      cb(null, path);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: PHOTO_LIMIT, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new BadRequestException('The photo must be an image.'), false);
  },
});

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Public: approved reviews for the landing page testimonials
  @Get('public')
  listPublic() {
    return this.reviews.listPublic();
  }

  // Student: own review (or null)
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req) {
    return this.reviews.getMine(req.user);
  }

  // Student: create / update own review (rating, exam, designation, message, photo)
  @Post('mine')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(photoUpload)
  saveMine(@Request() req, @Body() body: any, @UploadedFile() photo: Express.Multer.File) {
    return this.reviews.saveMine(req.user, body || {}, photo ? `/uploads/reviews/${photo.filename}` : null);
  }

  // Staff: every review for moderation
  @Get()
  @UseGuards(JwtAuthGuard)
  all(@Request() req) {
    return this.reviews.listAll(req.user);
  }

  // Staff: approve / reject
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  setStatus(@Request() req, @Param('id') id: string, @Body() body: { status?: string }) {
    return this.reviews.setStatus(req.user, id, body?.status || '');
  }

  // Staff: delete
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Request() req, @Param('id') id: string) {
    return this.reviews.remove(req.user, id);
  }
}
