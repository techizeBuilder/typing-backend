import { createConnection } from 'typeorm';
import { Exam, BackspaceRule, TestMode } from './entities/exam.entity';
import { ResultPattern, SpeedCountType, PenaltyType, QualifyType } from './entities/result_pattern.entity';
import { Chapter, FontGroup } from './entities/chapter.entity';
import { User, UserRole, UserStatus } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { Result } from './entities/result.entity';

dotenv.config();

async function seed() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: String(process.env.DB_PASSWORD || ''),
    database: process.env.DB_DATABASE || 'typing_app_db',
    entities: [Exam, Chapter, User, ResultPattern, Result],
    synchronize: true,
  });

  const examRepo = connection.getRepository(Exam);
  const patternRepo = connection.getRepository(ResultPattern);
  const chapterRepo = connection.getRepository(Chapter);
  const userRepo = connection.getRepository(User);

  // Seed Admin User
  const adminId = 'admin';
  const existingAdmin = await userRepo.findOneBy({ user_id: adminId });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = userRepo.create({
      user_id: adminId,
      name: 'Super Admin',
      phone: '0000000000',
      password_hash: hashedPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      city: 'Delhi',
      state: 'Delhi'
    });
    await userRepo.save(admin);
    console.log('Seeded Admin User: admin / admin123');
  }

  // Seed Result Patterns
  const patternsData = [
    { name: 'SSC Standard', speed_count: SpeedCountType.WORDS, half_mistake_enabled: true, penalty_type: PenaltyType.WORD, penalty_value: 1, qualify_on: QualifyType.NWPM, required_speed: 35, required_accuracy: 95 },
    { name: 'High Court', speed_count: SpeedCountType.WORDS, half_mistake_enabled: false, penalty_type: PenaltyType.WORD, penalty_value: 10, qualify_on: QualifyType.NWPM, required_speed: 40, required_accuracy: 90 },
  ];

  for (const p of patternsData) {
    const exists = await patternRepo.findOneBy({ name: p.name });
    if (!exists) {
      await patternRepo.save(patternRepo.create(p));
      console.log(`Seeded Result Pattern: ${p.name}`);
    }
  }

  const sscPattern = await patternRepo.findOneBy({ name: 'SSC Standard' });

  // Seed Exams
  const exams = [
    { name: 'SSC CGL', test_time_minutes: 15, screen_type: 'TCS', result_pattern: sscPattern || undefined, backspace_control: BackspaceRule.DISABLED },
    { name: 'SSC CHSL', test_time_minutes: 10, screen_type: 'TCS', result_pattern: sscPattern || undefined, backspace_control: BackspaceRule.DISABLED },
    { name: 'NTPC', test_time_minutes: 10, screen_type: 'Normal', result_pattern: sscPattern || undefined, backspace_control: BackspaceRule.FULL },
    { name: 'CRPF', test_time_minutes: 10, screen_type: 'Sarkari', result_pattern: sscPattern || undefined, backspace_control: BackspaceRule.DISABLED },
  ];

  for (const e of exams) {
    const exists = await examRepo.findOneBy({ name: e.name });
    if (!exists) {
      await examRepo.save(examRepo.create(e));
      console.log(`Seeded exam: ${e.name}`);
    }
  }

  // Seed Chapters
  const chapters = [
    {
      chapter_no: 1,
      name: 'Chapter 1: Basics',
      test_date: new Date(),
      font_group: FontGroup.ENGLISH_TYPING,
      content_text: 'The quick brown fox jumps over the lazy dog. Typing is a skill that improves with practice and consistency. Focus on accuracy before speed.',
    },
    {
      chapter_no: 2,
      name: 'Chapter 2: Intermediate',
      test_date: new Date(),
      font_group: FontGroup.ENGLISH_TYPING,
      content_text: 'Computer science is the study of algorithmic processes and computational machines. As a discipline, computer science spans a range of topics from theoretical studies of algorithms.',
    },
  ];

  for (const c of chapters) {
    const exists = await chapterRepo.findOneBy({ chapter_no: c.chapter_no, font_group: c.font_group });
    if (!exists) {
      await chapterRepo.save(chapterRepo.create(c));
      console.log(`Seeded chapter: ${c.name}`);
    }
  }

  await connection.close();
}

seed().catch(err => console.error(err));
