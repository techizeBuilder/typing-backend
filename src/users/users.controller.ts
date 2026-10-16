import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Request, UploadedFile, UseInterceptors, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { cleanStudentExtras } from '../common/management-fields';

// Profile photos: images only, max 2 MB (an uploaded .html/.svg would be served from /uploads).
const AVATAR_UPLOAD = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const path = './uploads/profiles';
      if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
      cb(null, path);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) && /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new BadRequestException('Photo must be a JPG, PNG, WEBP or GIF image.'), ok);
  },
};

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get('me')
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async getProfile(@Request() req): Promise<User | null> {
    return this.usersService.findById(req.user.userId);
  }

  @Put('me')
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async updateProfile(@Request() req, @Body() updateData: Partial<User>): Promise<any> {
    const allowedFields = ['name', 'fathers_name', 'city', 'state', 'phone', 'password_hash'];
    const safeData: Partial<User> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        safeData[field] = updateData[field];
      }
    }
    return this.usersService.update(req.user.userId, safeData);
  }

  @Post('me/avatar')
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('file', AVATAR_UPLOAD))
  async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const filePath = `/uploads/profiles/${file.filename}`;
    await this.usersService.update(req.user.userId, { profile_image: filePath });
    return { profile_image: filePath };
  }

  // Admin sets a student's photo (8.18).
  @Post(':id/avatar')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('file', AVATAR_UPLOAD))
  async uploadUserAvatar(@Param('id') id: string, @UploadedFile() file: Express.Multer.File): Promise<any> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!(await this.usersService.findById(id))) throw new BadRequestException('User not found');
    const filePath = `/uploads/profiles/${file.filename}`;
    await this.usersService.update(id, { profile_image: filePath });
    return { profile_image: filePath };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  findOne(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async create(@Body() userData: Partial<User>): Promise<User> {
    cleanStudentExtras(userData);
    if (userData.password_hash) {
      const bcrypt = require('bcrypt');
      userData.password_hash = await bcrypt.hash(userData.password_hash, 10);
    }
    return this.usersService.create(userData);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async update(@Param('id') id: string, @Body() userData: Partial<User>): Promise<any> {
    cleanStudentExtras(userData);
    return this.usersService.update(id, userData);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async remove(@Param('id') id: string): Promise<any> {
    return this.usersService.remove(id);
  }
}
