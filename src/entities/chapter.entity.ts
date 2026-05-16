import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export enum FontGroup {
  ENGLISH_TYPING = 'English Typing',
  HINDI_MANGAL = 'Hindi Mangal',
  HINDI_KRUTI_DEV = 'Hindi Kruti Dev',
  REMINGTON_GAIL = 'Hindi Remington (GAIL)',
  STENO_ENGLISH = 'Steno English',
  STENO_HINDI = 'Steno Hindi',
}

@Entity('chapters')
export class Chapter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  chapter_no: number;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  exam_id: string;

  @ManyToOne('Exam', { eager: true, nullable: true })
  @JoinColumn({ name: 'exam_id' })
  exam: any;

  @Column({ type: 'simple-array', nullable: true })
  exam_ids: string[];

  // Populated at runtime from exam_ids (not a DB column)
  exams?: any[];

  @Column({ type: 'date' })
  test_date: Date;

  @Column({ default: 'Pre-load Test' })
  test_type: string;

  @Column({
    type: 'enum',
    enum: FontGroup,
  })
  font_group: FontGroup;

  @Column({ type: 'text' })
  content_text: string;

  @Column({ nullable: true })
  audio_url: string; // Only populated for Steno

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
