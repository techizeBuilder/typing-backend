import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MagazinesService, MAGAZINE_DIR } from './magazines.service';

const PDF_LIMIT = 50 * 1024 * 1024; // 50 MB

@Controller('magazines')
@UseGuards(JwtAuthGuard)
export class MagazinesController {
  constructor(private readonly magazines: MagazinesService) {}

  // Signed-in users: one collection, with a `locked` flag per premium PDF.
  @Get()
  list(@Request() req, @Query('collection') collection: string) {
    return this.magazines.list(req.user.userId, collection);
  }

  // Staff: every magazine for management.
  @Get('admin')
  async all(@Request() req) {
    await this.magazines.assertStaff(req.user.userId);
    return this.magazines.listAll();
  }

  // Stream the PDF (inline; the client offers download). Premium PDFs need access.
  @Get(':id/file')
  async file(@Request() req, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { path, name } = await this.magazines.fileFor(req.user.userId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(fs.createReadStream(path));
  }

  @Post()
  @UseInterceptors(FileInterceptor('pdf', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(MAGAZINE_DIR)) fs.mkdirSync(MAGAZINE_DIR, { recursive: true });
        cb(null, MAGAZINE_DIR);
      },
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}.pdf`);
      },
    }),
    limits: { fileSize: PDF_LIMIT, files: 1 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') cb(null, true);
      else cb(new BadRequestException('Only PDF files can be uploaded.'), false);
    },
  }))
  async create(@Request() req, @Body() body: any, @UploadedFile() file: Express.Multer.File) {
    try {
      await this.magazines.assertStaff(req.user.userId);
    } catch (err) {
      if (file) fs.promises.unlink(file.path).catch(() => {});
      throw err;
    }
    return this.magazines.create(body, file);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() body: any) {
    await this.magazines.assertStaff(req.user.userId);
    return this.magazines.update(id, body);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.magazines.assertStaff(req.user.userId);
    return this.magazines.remove(id);
  }
}
