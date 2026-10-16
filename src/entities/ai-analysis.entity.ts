import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// One AI-written result analysis. Keyed by a hash of the student and the
// result's numbers so re-opening the same result never calls the AI again.
// Table created by SchemaSyncService.
@Entity('ai_analyses')
@Index(['student_id', 'input_hash'], { unique: true })
export class AiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'varchar', length: 64 })
  input_hash: string;

  @Column({ type: 'jsonb' })
  content: any;

  @Column({ type: 'varchar', length: 60 })
  model: string;

  @Column({ type: 'int', default: 0 })
  input_tokens: number;

  @Column({ type: 'int', default: 0 })
  output_tokens: number;

  @CreateDateColumn()
  created_at: Date;
}
