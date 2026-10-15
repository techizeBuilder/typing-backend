import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SupportService } from './support.service';
import { SupportAttachment } from '../entities/support_reply.entity';

const MAX_FILES = 3;
const IMAGE_LIMIT = 2 * 1024 * 1024;   // 2 MB
const VIDEO_LIMIT = 10 * 1024 * 1024;  // 10 MB

// Screenshots / short screen recordings attached to a ticket message.
const attachmentUpload = FilesInterceptor('files', MAX_FILES, {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const path = './uploads/support';
      if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
      cb(null, path);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: VIDEO_LIMIT, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new BadRequestException('Only images and videos can be attached.'), false);
  },
});

const toAttachments = (files: Express.Multer.File[] = []): SupportAttachment[] => {
  const tooBig = files.find((f) => f.mimetype.startsWith('image/') && f.size > IMAGE_LIMIT);
  if (tooBig) {
    files.forEach((f) => fs.promises.unlink(f.path).catch(() => {}));
    throw new BadRequestException(`${tooBig.originalname} is too large (images max 2 MB).`);
  }
  return files.map((f) => ({
    name: f.originalname,
    url: `/uploads/support/${f.filename}`,
    kind: f.mimetype.startsWith('video/') ? 'video' : 'image',
  }));
};

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // Student: raise a ticket (subject, category, priority, message, files[])
  @Post('tickets')
  @UseInterceptors(attachmentUpload)
  create(@Request() req, @Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    return this.support.create(req.user, body, toAttachments(files));
  }

  // Student: own tickets with their conversation
  @Get('tickets/mine')
  mine(@Request() req) {
    return this.support.listMine(req.user);
  }

  // Staff: every ticket (admins, super admins, sub-admins with 'support')
  @Get('tickets')
  all(@Request() req) {
    return this.support.listAll(req.user);
  }

  // Ticket owner or staff: add a reply
  @Post('tickets/:id/replies')
  @UseInterceptors(attachmentUpload)
  reply(@Request() req, @Param('id') id: string, @Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    return this.support.reply(req.user, id, body?.message, toAttachments(files));
  }

  // Staff: change status / priority
  @Patch('tickets/:id')
  update(@Request() req, @Param('id') id: string, @Body() body: { status?: string; priority?: string }) {
    return this.support.update(req.user, id, body || {});
  }
}
