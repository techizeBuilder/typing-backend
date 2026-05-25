import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Exam } from './exam.entity';
import { User } from './user.entity';
import { Chapter } from './chapter.entity';

@Entity('results')
export class Result {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  student_id: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'student_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  chapter_id: string;

  @ManyToOne(() => Chapter, { nullable: true, eager: false })
  @JoinColumn({ name: 'chapter_id' })
  chapter: Chapter;

  @ManyToOne(() => Exam)
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;

  @Column({ name: 'exam_id', nullable: true })
  exam_id: string;

  @Column({ type: 'int' })
  gwpm: number;

  @Column({ type: 'int' })
  nwpm: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  accuracy: number;

  @Column({ type: 'int' })
  total_errors: number;

  @Column({ type: 'int' })
  half_errors: number;

  @Column({ type: 'int' })
  full_errors: number;

  @Column({ type: 'int', default: 0 })
  total_strokes: number;

  @Column({ type: 'int', default: 600 })
  time_elapsed: number;

  @Column({ type: 'text', nullable: true })
  user_input: string;

  @Column({ type: 'jsonb', nullable: true })
  reference_words: string[];

  @Column({ type: 'jsonb', nullable: true })
  word_statuses: string[];

  @Column({ type: 'jsonb', nullable: true })
  pattern_data: any;

  @Column({ nullable: true })
  mode: string;

  @Column({ nullable: true })
  test_type: string;

  @CreateDateColumn()
  date_taken: Date;
}
