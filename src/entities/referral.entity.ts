import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// Commission earned when a referred student's FIRST plan is activated.
// One per subscription. Tables created by SchemaSyncService.
@Entity('referral_commissions')
export class ReferralCommission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referrer_id: string;

  @Column({ type: 'uuid' })
  referred_id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  subscription_id: string;

  @Column({ type: 'varchar', length: 60 })
  plan_name: string;

  @Column({ type: 'int' })
  base_amount: number; // amount the referred student paid

  @Column({ type: 'int' })
  rate: number; // percent

  @Column({ type: 'int' })
  amount: number; // rupees credited

  @CreateDateColumn()
  created_at: Date;
}

export const PAYOUT_STATUSES = ['Requested', 'Paid', 'Rejected'] as const;

// A referrer's request to withdraw their balance; the admin pays manually (UPI).
@Entity('referral_payouts')
export class ReferralPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referrer_id: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 100 })
  upi_id: string;

  @Column({ type: 'varchar', length: 20, default: 'Requested' })
  status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_ref: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  admin_note: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  processed_by: string | null;

  @CreateDateColumn()
  created_at: Date;
}
