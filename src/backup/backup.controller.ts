import { Controller, Get, Post, Delete, Param, Request, Res, UseGuards, ForbiddenException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupService } from './backup.service';
import { User, UserRole } from '../entities/user.entity';

// Backups contain every account (with password hashes), so only Admins and
// Super Admins can see, create, download or delete them.
@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(
    private readonly backups: BackupService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async admin(req: any) {
    const u = await this.users.findOne({ where: { id: req.user.userId } });
    if (!u || (u.role !== UserRole.ADMIN && u.role !== UserRole.SUPERADMIN)) throw new ForbiddenException('Only admins can manage backups.');
    return u;
  }

  @Get()
  async status(@Request() req) {
    await this.admin(req);
    return this.backups.status();
  }

  @Post()
  async create(@Request() req) {
    const u = await this.admin(req);
    return this.backups.startManual(u.user_id);
  }

  @Get(':name/download')
  async download(@Request() req, @Param('name') name: string, @Res({ passthrough: true }) res: Response) {
    await this.admin(req);
    const path = this.backups.pathFor(name);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(fs.statSync(path).size),
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(fs.createReadStream(path));
  }

  @Delete(':name')
  async remove(@Request() req, @Param('name') name: string) {
    await this.admin(req);
    return this.backups.remove(name);
  }
}
