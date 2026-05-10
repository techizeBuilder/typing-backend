import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter, FontGroup } from '../entities/chapter.entity';

@Injectable()
export class ChaptersService {
  constructor(
    @InjectRepository(Chapter)
    private chaptersRepository: Repository<Chapter>,
  ) {}

  findAll(): Promise<Chapter[]> {
    return this.chaptersRepository.find();
  }

  findFiltered(fontGroup?: FontGroup, testType?: string, examId?: string): Promise<Chapter[]> {
    const where: any = {};
    if (fontGroup) where.font_group = fontGroup;
    if (testType) where.test_type = testType;
    if (examId) where.exam_id = examId;
    return this.chaptersRepository.find({ where, order: { chapter_no: 'ASC' } });
  }

  async create(chapterData: Partial<Chapter>): Promise<Chapter> {
    const chapter = this.chaptersRepository.create(chapterData);
    return this.chaptersRepository.save(chapter);
  }

  async update(id: string, chapterData: Partial<Chapter>): Promise<any> {
    return this.chaptersRepository.update(id, chapterData);
  }

  async remove(id: string): Promise<any> {
    return this.chaptersRepository.delete(id);
  }
}
