import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ default: 'ALL' })
  target_audience: string; // "ALL", "ACTIVE", "INACTIVE", etc.

  @CreateDateColumn()
  created_at: Date;
}
