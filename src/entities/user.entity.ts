import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  SUPERADMIN = 'SuperAdmin',
  ADMIN = 'Admin',
  SUBADMIN = 'Sub-Admin',
  STUDENT = 'Student',
}

export enum UserStatus {
  PENDING = 'Pending',
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export enum UserCategory {
  TYPING_ENG = 'Typing English',
  TYPING_HIN = 'Typing Hindi',
  STENO_ENG = 'Steno English',
  STENO_HIN = 'Steno Hindi',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  @Column()
  name: string;

  @Column({ nullable: true })
  fathers_name: string;

  @Column({ unique: true })
  phone: string;

  @Column({ unique: true })
  user_id: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column()
  password_hash: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  category: string;

  @Column({ nullable: true })
  designation: string;

  @Column({ type: 'simple-array', nullable: true })
  permissions: string[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ type: 'date', nullable: true })
  validity_start: Date;

  @Column({ type: 'date', nullable: true })
  validity_end: Date;

  @Column({ nullable: true })
  allowed_login_time_start: string;

  @Column({ nullable: true })
  allowed_login_time_end: string;

  @Column({ nullable: true })
  profile_image: string;

  @Column({ type: 'date', nullable: true })
  last_fees_submitted_date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fees_amount: number;

  @Column({ nullable: true })
  roll_no: string;

  @Column({ type: 'int', nullable: true })
  live_tests_limit: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
