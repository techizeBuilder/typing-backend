import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const PLAN_CATEGORIES = ['typing', 'english_steno', 'hindi_steno', 'all'] as const;
export const SUBSCRIPTION_STATUSES = ['Requested', 'Active', 'Rejected', 'Cancelled'] as const;

// A purchasable plan. Activating it extends the student's validity by
// `duration_days` and (optionally) sets their test limits.
// Tables created by SchemaSyncService.
@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'all' })
  category: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  tagline: string | null;

  @Column({ type: 'int' })
  price: number; // rupees

  @Column({ type: 'int', nullable: true })
  original_price: number | null;

  @Column({ type: 'int' })
  duration_days: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  features: { label: string; included: boolean }[];

  @Column({ type: 'boolean', default: false })
  popular: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  // Test limits applied on activation (null = leave the student's limit unchanged).
  @Column({ type: 'int', nullable: true })
  preload_tests_limit: number | null;

  @Column({ type: 'int', nullable: true })
  steno_tests_limit: number | null;

  @Column({ type: 'int', nullable: true })
  live_tests_limit: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

// A student's request for / purchase of a plan. Requested → Active (admin
// records the payment) or Rejected / Cancelled. Expiry is derived from ends_on.
@Entity('plan_subscriptions')
export class PlanSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  student_id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  // Snapshot so history stays readable if the plan is edited later.
  @Column({ type: 'varchar', length: 60 })
  plan_name: string;

  @Column({ type: 'int' })
  plan_price: number;

  @Column({ type: 'int' })
  duration_days: number;

  @Column({ type: 'varchar', length: 20, default: 'Requested' })
  status: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  student_note: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  admin_note: string | null;

  @Column({ type: 'int', nullable: true })
  amount_paid: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_ref: string | null;

  @Column({ type: 'date', nullable: true })
  starts_on: string | null;

  @Column({ type: 'date', nullable: true })
  ends_on: string | null;

  @Column({ type: 'timestamp', nullable: true })
  activated_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  activated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
