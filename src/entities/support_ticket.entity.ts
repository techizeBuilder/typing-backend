import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Generated } from 'typeorm';

export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved'] as const;
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export const TICKET_CATEGORIES = [
  'Result / Score',
  'Payment / Subscription',
  'Test Not Loading',
  'Account / Login',
  'Other',
] as const;

// A student's help request. The conversation (including the first message)
// lives in support_replies. Table created by SchemaSyncService.
@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human-friendly number shown as T-1001, T-1002, …
  @Column({ type: 'int' })
  @Generated('increment')
  ticket_no: number;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'varchar', length: 60, default: 'Other' })
  category: string;

  @Column({ type: 'varchar', length: 20, default: 'Medium' })
  priority: string;

  @Column({ type: 'varchar', length: 20, default: 'Open' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
