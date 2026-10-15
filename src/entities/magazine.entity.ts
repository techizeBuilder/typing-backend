import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const MAGAZINE_COLLECTIONS = ['kc', 'progressive'] as const;

// A PDF magazine (KC / Progressive). The file lives outside the public uploads
// folder and is streamed only to signed-in users who may open it.
// Table created by SchemaSyncService.
@Entity('magazines')
export class Magazine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  collection: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  folder: string | null;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar' })
  file_path: string; // stored file name inside the private magazines folder

  @Column({ type: 'int', default: 0 })
  size_bytes: number;

  @Column({ type: 'int', nullable: true })
  pages: number | null;

  @Column({ type: 'boolean', default: false })
  is_premium: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
