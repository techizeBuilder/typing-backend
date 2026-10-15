import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export interface SupportAttachment {
  name: string;
  url: string; // /uploads/support/<file>
  kind: 'image' | 'video';
}

// One message in a support ticket's conversation. Table created by SchemaSyncService.
@Entity('support_replies')
export class SupportReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'uuid' })
  author_id: string;

  // 'student' or 'staff' (admin / sub-admin)
  @Column({ type: 'varchar', length: 20 })
  author_type: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author_name: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments: SupportAttachment[];

  @CreateDateColumn()
  created_at: Date;
}
