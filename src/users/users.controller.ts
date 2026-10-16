import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Request, UploadedFile, UseInterceptors, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, isFullAdmin } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

const STAFF_ROLES: string[] = [UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN];
const sameSet = (a: string[] | null | undefined, b: string[] | null | undefined) => {
  const x = [...new Set(a || [])].sort(); const y = [...new Set(b || [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

// Who may create / change / delete which account:
// - Sub-Admins need the "students" module for student accounts and the "staff"
//   module for staff accounts, can only hand out modules they have themselves,
//   and can never touch Admin or Super Admin accounts.
// - Only a Super Admin can create, change or remove a Super Admin.
// - Nobody changes their own role or permissions, or deletes themselves.
function assertCanManage(actor: any, target: Partial<User> | null, changes: Partial<User> | null) {
  const roles = [target?.role, changes?.role].filter(Boolean) as string[];
  if (changes?.role !== undefined && !Object.values(UserRole).includes(changes.role as UserRole)) throw new BadRequestException('Unknown role.');
  if (roles.includes(UserRole.SUPERADMIN) && actor.role !== UserRole.SUPERADMIN) throw new ForbiddenException('Only a Super Admin can manage Super Admin accounts.');
  if (!isFullAdmin(actor.role)) {
    if (roles.includes(UserRole.ADMIN)) throw new ForbiddenException('Only an Admin can manage Admin accounts.');
    const perms: string[] = actor.permissions || [];
    if (roles.some((r) => STAFF_ROLES.includes(r)) && !perms.includes('staff')) throw new ForbiddenException('You do not have access to Staff Management.');
    if (roles.includes(UserRole.STUDENT) && !perms.includes('students')) throw new ForbiddenException('You do not have access to Students.');
    if (changes?.permissions && changes.permissions.some((p) => !perms.includes(p))) throw new ForbiddenException('You can only give modules that you have yourself.');
  }
  if (target && target.id === actor.userId && changes) {
    if (changes.role !== undefined && changes.role !== target.role) throw new ForbiddenException('You cannot change your own role.');
    if (changes.permissions !== undefined && !sameSet(changes.permissions, target.permissions)) throw new ForbiddenException('You cannot change your own permissions.');
  }
}

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
  async findAll(@Request() req): Promise<User[]> {
    const users = await this.usersService.findAll();
    if (isFullAdmin(req.user.role)) return users;
    const perms: string[] = req.user.permissions || [];
    // The dashboard counts students for every staff member, so students stay visible.
    return users.filter((u) => u.role === UserRole.STUDENT || (perms.includes('staff') && u.role !== UserRole.SUPERADMIN));
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

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async findOne(@Request() req, @Param('id') id: string): Promise<User | null> {
    const user = await this.usersService.findById(id);
    if (user && user.id !== req.user.userId) assertCanManage(req.user, user, null);
    return user;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async create(@Request() req, @Body() userData: Partial<User>): Promise<User> {
    if (!userData || typeof userData !== 'object') throw new BadRequestException('User data is required.');
    delete (userData as any).id;
    userData.role = (userData.role || UserRole.STUDENT) as UserRole;
    assertCanManage(req.user, null, userData);
    if (userData.password_hash) {
      const bcrypt = require('bcrypt');
      userData.password_hash = await bcrypt.hash(userData.password_hash, 10);
    }
    return this.usersService.create(userData);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async update(@Request() req, @Param('id') id: string, @Body() userData: Partial<User>): Promise<any> {
    if (!userData || typeof userData !== 'object') throw new BadRequestException('User data is required.');
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    delete (userData as any).id;
    assertCanManage(req.user, target, userData);
    return this.usersService.update(id, userData);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  async remove(@Request() req, @Param('id') id: string): Promise<any> {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    if (target.id === req.user.userId) throw new ForbiddenException('You cannot delete your own account.');
    assertCanManage(req.user, target, null);
    return this.usersService.remove(id);
  }
}
