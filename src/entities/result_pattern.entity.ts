import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SpeedCountType {
  WORDS = 'Words',
  STROKES = 'Strokes',
}

export enum QualifyType {
  GWPM = 'GWPM',
  NWPM = 'NWPM',
}

export enum PenaltyType {
  WORD = 'Word',
  STROKE = 'Stroke',
}

@Entity('result_patterns')
export class ResultPattern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // "Result Name" in screenshot

  @Column({ default: SpeedCountType.WORDS })
  speed_count: SpeedCountType;

  @Column({ default: false })
  half_mistake_enabled: boolean;

  @Column({ default: PenaltyType.WORD })
  penalty_type: PenaltyType;

  @Column({ type: 'float', default: 1 })
  penalty_value: number;

  @Column({ default: false })
  count_right_words_only: boolean;

  @Column({ default: QualifyType.NWPM })
  qualify_on: QualifyType;

  @Column({ type: 'float', default: 35 })
  required_speed: number;

  @Column({ type: 'float', default: 95 })
  required_accuracy: number;

  // When enabled, mistakes up to (ignorable_mistakes_percent)% of the total words
  // typed are ignored (no penalty). Every mistake BEYOND that allowance deducts
  // (ignorable_penalty_words_per_mistake) words from the net-speed calculation.
  @Column({ default: false })
  ignorable_mistakes_enabled: boolean;

  // Ignorable allowance as a percentage (0–100) of the total words typed.
  @Column({ type: 'float', default: 0 })
  ignorable_mistakes_percent: number;

  // Words deducted from net speed for each mistake beyond the ignorable allowance.
  @Column({ type: 'float', default: 10 })
  ignorable_penalty_words_per_mistake: number;

  @Column({ default: true })
  show_half_mistakes: boolean;

  @Column({ default: true })
  show_full_mistakes: boolean;

  @Column({ default: true })
  show_total_strokes: boolean;

  @Column({ default: true })
  show_total_words: boolean;

  @Column({ default: true })
  show_total_errors: boolean;

  @Column({ default: true })
  show_correct_words: boolean;

  @Column({ default: true })
  show_gross_speed: boolean;

  @Column({ default: true })
  show_net_speed: boolean;

  @Column({ default: true })
  show_accuracy: boolean;

  @Column({ default: true })
  show_penalty_words: boolean;

  @Column({ default: true })
  show_ignorable_mistakes: boolean;

  @Column({ default: true })
  count_omissions_as_errors: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
