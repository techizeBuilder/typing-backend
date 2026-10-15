import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { join } from 'path';
import { Magazine, MAGAZINE_COLLECTIONS } from '../entities/magazine.entity';
import { User, UserRole } from '../entities/user.entity';
import { hasPremiumAccess } from '../common/premium';

// Private storage: NOT under the statically served uploads folder.
export const MAGAZINE_DIR = join(process.cwd(), 'private', 'magazines');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rough page count from the PDF's page objects (good enough for display).
export function countPdfPages(path: string): number | null {
  try {
    const text = fs.readFileSync(path).toString('latin1');
    const n = (text.match(/\/Type\s*\/Page(?![a-z])/g) || []).length;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

@Injectable()
export class MagazinesService {
  constructor(
    @InjectRepository(Magazine) private readonly magazines: Repository<Magazine>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async user(userId: string) {
    const u = await this.users.findOne({ where: { id: userId } });
    if (!u) throw new ForbiddenException();
    return u;
  }

  // Admins and super admins always; sub-admins with the 'magazines' permission.
  async assertStaff(userId: string) {
    const u = await this.user(userId);
    if (u.role === UserRole.ADMIN || u.role === UserRole.SUPERADMIN) return;
    if (u.role === UserRole.SUBADMIN && (u.permissions || []).includes('magazines')) return;
    throw new ForbiddenException('You do not have access to magazines.');
  }

  private public(m: Magazine, premium: boolean) {
    const { file_path, ...rest } = m;
    return { ...rest, locked: m.is_premium && !premium };
  }

  async list(userId: string, collection: string) {
    if (!MAGAZINE_COLLECTIONS.includes(collection as any)) throw new BadRequestException('Unknown collection.');
    const premium = hasPremiumAccess(await this.user(userId));
    const rows = await this.magazines.find({ where: { collection }, order: { folder: 'ASC', sort_order: 'ASC', created_at: 'ASC' } });
    return { premium, magazines: rows.map((m) => this.public(m, premium)) };
  }

  async listAll() {
    const rows = await this.magazines.find({ order: { collection: 'ASC', folder: 'ASC', sort_order: 'ASC', created_at: 'ASC' } });
    return rows.map((m) => this.public(m, true));
  }

  // File for viewing / downloading; premium files need premium access.
  async fileFor(userId: string, id: string) {
    const m = UUID.test(id || '') ? await this.magazines.findOne({ where: { id } }) : null;
    if (!m) throw new NotFoundException('Magazine not found.');
    if (m.is_premium && !hasPremiumAccess(await this.user(userId))) {
      throw new ForbiddenException('This magazine needs an active plan.');
    }
    const path = join(MAGAZINE_DIR, m.file_path);
    if (!fs.existsSync(path)) throw new NotFoundException('The PDF file is missing on the server.');
    return { path, name: `${m.title.replace(/[^\w\- ]+/g, '').trim() || 'magazine'}.pdf` };
  }

  private clean(body: any, partial: boolean) {
    const out: Partial<Magazine> = {};
    const text = (key: string, max: number, required = false) => {
      if (body?.[key] === undefined) {
        if (required && !partial) throw new BadRequestException(`${key} is required.`);
        return;
      }
      const v = String(body[key] ?? '').trim();
      if (required && !v) throw new BadRequestException(`${key} is required.`);
      if (v.length > max) throw new BadRequestException(`${key} must be at most ${max} characters.`);
      (out as any)[key] = v || null;
    };
    if (body?.collection !== undefined || !partial) {
      if (!MAGAZINE_COLLECTIONS.includes(body?.collection)) throw new BadRequestException('collection must be kc or progressive.');
      out.collection = body.collection;
    }
    text('title', 150, true);
    text('subtitle', 200);
    text('folder', 80);
    if (body?.is_premium !== undefined) out.is_premium = body.is_premium === true || body.is_premium === 'true';
    if (body?.sort_order !== undefined) {
      const n = Number(body.sort_order);
      if (!Number.isInteger(n) || n < 0 || n > 100000) throw new BadRequestException('sort_order must be a whole number.');
      out.sort_order = n;
    }
    return out;
  }

  async create(body: any, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose a PDF file to upload.');
    try {
      const data = this.clean(body, false);
      const m = this.magazines.create({ ...data, file_path: file.filename, size_bytes: file.size, pages: countPdfPages(file.path) });
      return this.public(await this.magazines.save(m), true);
    } catch (err) {
      fs.promises.unlink(file.path).catch(() => {});
      throw err;
    }
  }

  async update(id: string, body: any) {
    const m = UUID.test(id || '') ? await this.magazines.findOne({ where: { id } }) : null;
    if (!m) throw new NotFoundException('Magazine not found.');
    Object.assign(m, this.clean(body, true));
    return this.public(await this.magazines.save(m), true);
  }

  async remove(id: string) {
    const m = UUID.test(id || '') ? await this.magazines.findOne({ where: { id } }) : null;
    if (!m) throw new NotFoundException('Magazine not found.');
    await this.magazines.delete({ id: m.id });
    fs.promises.unlink(join(MAGAZINE_DIR, m.file_path)).catch(() => {});
    return { deleted: true };
  }
}
