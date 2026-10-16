import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('flash_banners')
export class FlashBanner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column({ default: true })
  is_active: boolean;

  // Optional extras (8.18): heading, click-through link, colour and a show window
  @Column({ type: 'varchar', length: 80, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  link_url: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'date', nullable: true })
  start_date: string | null;

  @Column({ type: 'date', nullable: true })
  end_date: string | null;

  @CreateDateColumn()
  created_at: Date;
}
