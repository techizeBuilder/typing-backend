import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from '../entities/exam.entity';
import { Chapter } from '../entities/chapter.entity';
import { Result } from '../entities/result.entity';

@Injectable()
export class ExamsService implements OnModuleInit {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    @InjectRepository(Exam)
    private examsRepository: Repository<Exam>,
    @InjectRepository(Chapter)
    private chaptersRepository: Repository<Chapter>,
    @InjectRepository(Result)
    private resultsRepository: Repository<Result>,
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

  async remove(id: string, force = false): Promise<any> {
    const exam = await this.examsRepository.findOneBy({ id });
    if (!exam) {
      throw new NotFoundException('Exam not found.');
    }

    const resultsCount = await this.resultsRepository.count({ where: { exam_id: id } });
    const chapters = await this.chaptersRepository.find();
    const linkedChapters = chapters.filter(
      (c) => c.exam_id === id || (Array.isArray(c.exam_ids) && c.exam_ids.includes(id)),
    );

    if (!force) {
      if (resultsCount > 0) {
        throw new ConflictException(
          `Cannot delete this exam because ${resultsCount} result${resultsCount === 1 ? '' : 's'} ${resultsCount === 1 ? 'is' : 'are'} already recorded against it. Delete those results first, or use Force Delete.`,
        );
      }

      // Chapters reference an exam via exam_id / exam_ids (not an enforced FK), so
      // deleting the exam wouldn't fail at the DB level but would leave chapters
      // pointing at a non-existent exam — surface it as a dependency instead.
      if (linkedChapters.length > 0) {
        throw new ConflictException(
          `Cannot delete this exam because it is linked to ${linkedChapters.length} chapter${linkedChapters.length === 1 ? '' : 's'} (${linkedChapters.map((c) => c.chapter_no ?? c.id).join(', ')}). Unlink it from those chapters first, or use Force Delete.`,
        );
      }
    } else {
      // Force delete: permanently remove all results recorded against this exam,
      // and detach (not delete) any chapter that referenced it — chapters are
      // reusable content, not exam-owned data.
      if (resultsCount > 0) {
        await this.resultsRepository.delete({ exam_id: id });
        this.logger.warn(`Force-deleted ${resultsCount} result(s) for exam ${id}.`);
      }
      if (linkedChapters.length > 0) {
        for (const chapter of linkedChapters) {
          if (chapter.exam_id === id) chapter.exam_id = null as any;
          if (Array.isArray(chapter.exam_ids)) {
            chapter.exam_ids = chapter.exam_ids.filter((examId) => examId !== id);
          }
        }
        await this.chaptersRepository.save(linkedChapters);
        this.logger.warn(`Force-delete: unlinked exam ${id} from ${linkedChapters.length} chapter(s).`);
      }
    }

    try {
      return await this.examsRepository.delete(id);
    } catch (err: any) {
      // Fallback for any other FK we didn't anticipate above.
      if (err?.code === '23503') {
        throw new ConflictException('Cannot delete this exam because other records still reference it.');
      }
      throw err;
    }
  }
}
