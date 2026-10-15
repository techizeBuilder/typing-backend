import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FontGroupSetting } from '../entities/font-group-setting.entity';
import { Chapter, FontGroup } from '../entities/chapter.entity';
import { Exam } from '../entities/exam.entity';
import { User, UserRole } from '../entities/user.entity';

const GROUPS = Object.values(FontGroup) as string[];

@Injectable()
export class FontGroupsService {
  constructor(
    @InjectRepository(FontGroupSetting) private readonly settings: Repository<FontGroupSetting>,
    @InjectRepository(Chapter) private readonly chapters: Repository<Chapter>,
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Admins and super admins always; sub-admins with the 'exams' permission.
  async assertStaff(userId: string) {
    const u = await this.users.findOne({ where: { id: userId } });
    if (u && (u.role === UserRole.ADMIN || u.role === UserRole.SUPERADMIN)) return;
    if (u && u.role === UserRole.SUBADMIN && (u.permissions || []).includes('exams')) return;
    throw new ForbiddenException('You do not have access to font groups.');
  }

  // All built-in groups with their settings (public: used to hide inactive groups).
  async list() {
    const rows = await this.settings.find();
    const byGroup = new Map(rows.map((r) => [r.font_group, r]));
    return GROUPS.map((value) => {
      const s = byGroup.get(value);
      return {
        value,
        is_active: s ? s.is_active : true,
        description: s?.description ?? null,
        preview_text: s?.preview_text ?? null,
        updated_at: s?.updated_at ?? null,
      };
    });
  }

  // Admin view: settings plus how many tests and exams use each group.
  async listWithUsage() {
    const [groups, chapterCounts, exams] = await Promise.all([
      this.list(),
      this.chapters.createQueryBuilder('c')
        .select('c.font_group', 'font_group')
        .addSelect('COUNT(*)', 'total')
        .addSelect(`SUM(CASE WHEN c.test_type = 'Live Test' THEN 1 ELSE 0 END)`, 'live')
        .groupBy('c.font_group')
        .getRawMany(),
      this.exams.find({ select: ['id', 'font_group', 'font_groups'] }),
    ]);
    const counts = new Map(chapterCounts.map((r) => [r.font_group, { total: Number(r.total), live: Number(r.live) }]));
    return groups.map((g) => ({
      ...g,
      tests: counts.get(g.value)?.total || 0,
      live_tests: counts.get(g.value)?.live || 0,
      exams: exams.filter((e) => {
        const list = Array.isArray(e.font_groups) && e.font_groups.length ? e.font_groups : [e.font_group];
        return list.includes(g.value as FontGroup);
      }).length,
    }));
  }

  async update(value: string, body: any) {
    if (!GROUPS.includes(value)) throw new NotFoundException('Unknown font group.');
    const patch: Partial<FontGroupSetting> = {};
    if (body?.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') throw new BadRequestException('is_active must be true or false.');
      patch.is_active = body.is_active;
    }
    for (const [field, max] of [['description', 300], ['preview_text', 200]] as const) {
      if (body?.[field] === undefined) continue;
      const v = body[field] === null ? '' : String(body[field]).trim();
      if (v.length > max) throw new BadRequestException(`${field} must be at most ${max} characters.`);
      patch[field] = v || null;
    }
    const existing = await this.settings.findOne({ where: { font_group: value } });
    await this.settings.save({ ...(existing || { font_group: value, is_active: true }), ...patch });
    return (await this.list()).find((g) => g.value === value);
  }
}
