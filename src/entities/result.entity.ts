import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Exam } from './exam.entity';
import { User } from './user.entity';

@Entity('results')
export class Result {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // We map IDs explicitly or use relationships. Sticking to IDs for direct logic simplicity.
  @Column('uuid')
  student_id: string;

  @Column({ type: 'uuid', nullable: true })
  chapter_id: string;

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

  @CreateDateColumn()
  date_taken: Date;
}
