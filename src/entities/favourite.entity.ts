import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// A student's saved dictations ("My Dictations"): favourites plus their own
// folders. Tables created by SchemaSyncService.
@Entity('student_favourites')
@Index(['student_id', 'chapter_id'], { unique: true })
export class StudentFavourite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'uuid' })
  chapter_id: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('student_folders')
export class StudentFolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('student_folder_items')
@Index(['folder_id', 'chapter_id'], { unique: true })
export class StudentFolderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  folder_id: string;

  @Column({ type: 'uuid' })
  chapter_id: string;

  @CreateDateColumn()
  created_at: Date;
}
