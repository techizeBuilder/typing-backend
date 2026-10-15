import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StudentFavourite, StudentFolder, StudentFolderItem } from '../entities/favourite.entity';
import { Chapter } from '../entities/chapter.entity';
import { Exam } from '../entities/exam.entity';

const MAX_FOLDERS = 50;
const MAX_NAME = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class FavouritesService {
  constructor(
    @InjectRepository(StudentFavourite) private readonly favourites: Repository<StudentFavourite>,
    @InjectRepository(StudentFolder) private readonly folders: Repository<StudentFolder>,
    @InjectRepository(StudentFolderItem) private readonly items: Repository<StudentFolderItem>,
    @InjectRepository(Chapter) private readonly chapters: Repository<Chapter>,
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
  ) {}

  // Everything the student has saved, with display details for each dictation.
  async getMine(studentId: string) {
    const [favs, folders] = await Promise.all([
      this.favourites.find({ where: { student_id: studentId }, order: { created_at: 'DESC' } }),
      this.folders.find({ where: { student_id: studentId }, order: { created_at: 'ASC' } }),
    ]);
    const items = folders.length
      ? await this.items.find({ where: { folder_id: In(folders.map((f) => f.id)) }, order: { created_at: 'DESC' } })
      : [];
    const chapterIds = [...new Set([...favs.map((f) => f.chapter_id), ...items.map((i) => i.chapter_id)])];
    const chapters = chapterIds.length
      ? await this.chapters.find({
          where: { id: In(chapterIds) },
          select: ['id', 'chapter_no', 'name', 'font_group', 'test_type', 'exam_id', 'exam_ids', 'word_count', 'steno_speed', 'difficulty', 'test_date'],
        })
      : [];
    const examIds = [...new Set(chapters.map((c) => c.exam_id).filter(Boolean))];
    const exams = examIds.length ? await this.exams.find({ where: { id: In(examIds) }, select: ['id', 'name'] }) : [];
    const examName = new Map(exams.map((e) => [e.id, e.name]));
    const details = Object.fromEntries(chapters.map((c) => [c.id, { ...c, exam_name: examName.get(c.exam_id) || null }]));
    // Dictations deleted by the admin simply drop out of the lists.
    return {
      favourites: favs.map((f) => f.chapter_id).filter((id) => details[id]),
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        chapter_ids: items.filter((i) => i.folder_id === f.id && details[i.chapter_id]).map((i) => i.chapter_id),
      })),
      chapters: details,
    };
  }

  private async assertChapter(chapterId: string) {
    if (!UUID.test(chapterId || '') || !(await this.chapters.exist({ where: { id: chapterId } }))) {
      throw new NotFoundException('Dictation not found.');
    }
  }

  private async ownFolder(studentId: string, folderId: string) {
    const folder = UUID.test(folderId || '') ? await this.folders.findOne({ where: { id: folderId, student_id: studentId } }) : null;
    if (!folder) throw new NotFoundException('Folder not found.');
    return folder;
  }

  private cleanName(name: unknown) {
    const n = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!n) throw new BadRequestException('Folder name is required.');
    if (n.length > MAX_NAME) throw new BadRequestException(`Folder name must be at most ${MAX_NAME} characters.`);
    return n;
  }

  async addFavourite(studentId: string, chapterId: string) {
    await this.assertChapter(chapterId);
    await this.favourites.createQueryBuilder().insert().values({ student_id: studentId, chapter_id: chapterId }).orIgnore().execute();
    return { favourite: true };
  }

  async removeFavourite(studentId: string, chapterId: string) {
    await this.favourites.delete({ student_id: studentId, chapter_id: chapterId });
    return { favourite: false };
  }

  async createFolder(studentId: string, name: unknown) {
    const clean = this.cleanName(name);
    const existing = await this.folders.find({ where: { student_id: studentId } });
    if (existing.length >= MAX_FOLDERS) throw new BadRequestException(`You can have at most ${MAX_FOLDERS} folders.`);
    if (existing.some((f) => f.name.toLowerCase() === clean.toLowerCase())) throw new BadRequestException('A folder with this name already exists.');
    const folder = await this.folders.save(this.folders.create({ student_id: studentId, name: clean }));
    return { id: folder.id, name: folder.name, chapter_ids: [] };
  }

  async renameFolder(studentId: string, folderId: string, name: unknown) {
    const folder = await this.ownFolder(studentId, folderId);
    const clean = this.cleanName(name);
    const others = await this.folders.find({ where: { student_id: studentId } });
    if (others.some((f) => f.id !== folder.id && f.name.toLowerCase() === clean.toLowerCase())) throw new BadRequestException('A folder with this name already exists.');
    folder.name = clean;
    await this.folders.save(folder);
    return { id: folder.id, name: folder.name };
  }

  async deleteFolder(studentId: string, folderId: string) {
    const folder = await this.ownFolder(studentId, folderId);
    await this.items.delete({ folder_id: folder.id });
    await this.folders.delete({ id: folder.id });
    return { deleted: true };
  }

  async addToFolder(studentId: string, folderId: string, chapterId: string) {
    const folder = await this.ownFolder(studentId, folderId);
    await this.assertChapter(chapterId);
    await this.items.createQueryBuilder().insert().values({ folder_id: folder.id, chapter_id: chapterId }).orIgnore().execute();
    return { added: true };
  }

  async removeFromFolder(studentId: string, folderId: string, chapterId: string) {
    const folder = await this.ownFolder(studentId, folderId);
    await this.items.delete({ folder_id: folder.id, chapter_id: chapterId });
    return { removed: true };
  }
}
