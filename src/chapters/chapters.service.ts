import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Chapter, FontGroup } from '../entities/chapter.entity';
import { Exam } from '../entities/exam.entity';

@Injectable()
export class ChaptersService implements OnModuleInit {
  private readonly logger = new Logger(ChaptersService.name);

  constructor(
    @InjectRepository(Chapter)
    private chaptersRepository: Repository<Chapter>,
    @InjectRepository(Exam)
    private examsRepository: Repository<Exam>,
  ) {}

  async onModuleInit() {
    // Ensure the exam_ids column exists (added for multi-exam assignment).
    // Safe to run repeatedly because of IF NOT EXISTS.
    try {
      await this.chaptersRepository.query(
        `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS exam_ids TEXT`,
      );
    } catch (err) {
      this.logger.warn(`Could not ensure chapters.exam_ids column: ${err?.message || err}`);
    }

    // Chapter numbers may be alphanumeric (e.g. A-1, CH-01). Widen the legacy
    // integer column to varchar in place; existing numeric values cast cleanly.
    try {
      await this.chaptersRepository.query(
        `ALTER TABLE chapters ALTER COLUMN chapter_no TYPE VARCHAR USING chapter_no::VARCHAR`,
      );
    } catch (err) {
      this.logger.warn(`Could not widen chapters.chapter_no to varchar: ${err?.message || err}`);
    }
  }

  private async attachExams(chapters: Chapter[]): Promise<Chapter[]> {
    const ids = new Set<string>();
    for (const c of chapters) {
      if (Array.isArray(c.exam_ids)) c.exam_ids.forEach((id) => id && ids.add(id));
      if (c.exam_id) ids.add(c.exam_id);
    }
    if (ids.size === 0) {
      for (const c of chapters) c.exams = c.exam ? [c.exam] : [];
      return chapters;
    }
    const exams = await this.examsRepository.find({ where: { id: In(Array.from(ids)) } });
    const examMap = new Map(exams.map((e) => [e.id, e]));
    for (const c of chapters) {
      const list = Array.isArray(c.exam_ids) ? c.exam_ids : [];
      c.exams = list.map((id) => examMap.get(id)).filter(Boolean);
      if (c.exams.length === 0 && c.exam) c.exams = [c.exam];
    }
    return chapters;
  }

  async findOne(id: string): Promise<Chapter | null> {
    return this.chaptersRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Chapter[]> {
    const chapters = await this.chaptersRepository.find();
    return this.attachExams(chapters);
  }

  // summary=true omits content_text (the full passage — by far the heaviest
  // column) for callers that only need chapter metadata, e.g. the admin dashboard.
  async findFiltered(fontGroup?: FontGroup, testType?: string, examId?: string, summary = false): Promise<Chapter[]> {
    const where: any = {};
    if (fontGroup) where.font_group = fontGroup;
    if (testType) where.test_type = testType;
    const select = summary
      ? ([
          'id', 'chapter_no', 'name', 'exam_id', 'exam_ids', 'test_date', 'test_type',
          'font_group', 'language_type', 'hindi_font_type', 'word_count', 'audio_url',
          'steno_speed', 'created_at', 'updated_at',
        ] as (keyof Chapter)[])
      : undefined;
    let chapters = await this.chaptersRepository.find({ where, select, order: { chapter_no: 'ASC' } });
    if (examId) {
      chapters = chapters.filter((c) => {
        if (c.exam_id === examId) return true;
        if (Array.isArray(c.exam_ids) && c.exam_ids.includes(examId)) return true;
        return false;
      });
    }
    return this.attachExams(chapters);
  }

  async create(chapterData: Partial<Chapter>): Promise<Chapter> {
    this.normalizeExamIds(chapterData);
    const chapter = this.chaptersRepository.create(chapterData);
    return this.chaptersRepository.save(chapter);
  }

  async update(id: string, chapterData: Partial<Chapter>): Promise<any> {
    this.normalizeExamIds(chapterData);
    return this.chaptersRepository.update(id, chapterData);
  }

  async remove(id: string): Promise<any> {
    return this.chaptersRepository.delete(id);
  }

  private normalizeExamIds(data: Partial<Chapter>): void {
    if (data.exam_ids !== undefined) {
      const arr = Array.isArray(data.exam_ids)
        ? data.exam_ids.filter((v) => !!v)
        : [];
      data.exam_ids = arr;
      if (!data.exam_id && arr.length > 0) data.exam_id = arr[0];
      if (arr.length === 0) data.exam_id = null as any;
    }
  }
}
