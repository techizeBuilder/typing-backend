import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from '../entities/exam.entity';
import { Chapter } from '../entities/chapter.entity';

@Injectable()
export class ExamsService implements OnModuleInit {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    @InjectRepository(Exam)
    private examsRepository: Repository<Exam>,
    @InjectRepository(Chapter)
    private chaptersRepository: Repository<Chapter>,
  ) {}

  async onModuleInit() {
    // Ensure font_groups column exists (added for multi-font-group assignment).
    // Safe to run repeatedly because of IF NOT EXISTS.
    try {
      await this.examsRepository.query(
        `ALTER TABLE exams ADD COLUMN IF NOT EXISTS font_groups TEXT`,
      );
      this.logger.log('Ensured exams.font_groups column exists.');
    } catch (err) {
      this.logger.warn(`Could not ensure exams.font_groups column: ${err?.message || err}`);
    }
  }

  findAll(): Promise<Exam[]> {
    return this.examsRepository.find({ relations: ['result_pattern'] });
  }

  findOne(id: string): Promise<Exam | null> {
    return this.examsRepository.findOneBy({ id });
  }

  async create(examData: Partial<Exam>): Promise<Exam> {
    const exam = this.examsRepository.create(examData);
    const saved = await this.examsRepository.save(exam);
    await this.linkExistingChaptersByFontGroup(saved);
    return saved;
  }

  /**
   * Auto-link a newly created exam to every existing chapter that belongs to the
   * same font group(s). The exam<->chapter relationship is stored on the chapter
   * side via `exam_ids`, so we append the new exam id to each matching chapter.
   * This avoids having to manually reassign chapters whenever an exam is added.
   */
  private async linkExistingChaptersByFontGroup(exam: Exam): Promise<void> {
    try {
      // Collect the exam's font groups (multi-select + legacy single column).
      const groups = new Set<string>();
      if (Array.isArray(exam.font_groups)) {
        exam.font_groups.forEach((g) => g && groups.add(g));
      }
      if (exam.font_group) groups.add(exam.font_group as unknown as string);

      if (groups.size === 0) return;

      const chapters = await this.chaptersRepository.find();
      const toUpdate: Chapter[] = [];

      for (const chapter of chapters) {
        if (!chapter.font_group || !groups.has(chapter.font_group as unknown as string)) {
          continue;
        }
        const existing = Array.isArray(chapter.exam_ids) ? chapter.exam_ids : [];
        if (existing.includes(exam.id)) continue;
        chapter.exam_ids = [...existing, exam.id];
        // Keep the legacy single exam_id populated if it was empty.
        if (!chapter.exam_id) chapter.exam_id = exam.id;
        toUpdate.push(chapter);
      }

      if (toUpdate.length > 0) {
        await this.chaptersRepository.save(toUpdate);
        this.logger.log(
          `Auto-linked exam "${exam.name}" (${exam.id}) to ${toUpdate.length} existing chapter(s) by font group.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Could not auto-link exam ${exam?.id} to chapters by font group: ${err?.message || err}`,
      );
    }
  }

  async update(id: string, examData: Partial<Exam>): Promise<any> {
    return this.examsRepository.update(id, examData);
  }

  async remove(id: string): Promise<any> {
    return this.examsRepository.delete(id);
  }
}
