import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const REVIEW_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

// A student's review of the institute/app. One per student; editing it sends it
// back for moderation. Only Approved reviews are public (landing page).
// Table created by SchemaSyncService.
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  student_id: string;

  @Column({ type: 'int' })
  rating: number; // 1–5

  @Column({ type: 'varchar', length: 150 })
  exam: string; // exam the student is preparing for / cleared

  @Column({ type: 'varchar', length: 150, nullable: true })
  designation: string | null; // optional, e.g. "Stenographer, Delhi High Court"

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', nullable: true })
  photo_url: string | null;

  @Column({ type: 'varchar', length: 20, default: 'Pending' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
