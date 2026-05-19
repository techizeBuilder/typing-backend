import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ResultPattern } from './result_pattern.entity';
import { FontGroup } from './chapter.entity';

export enum BackspaceRule {
  DISABLED = 'No Backspace',
  TWO_WORDS = 'Two Words Backspace',
  CURRENT_WORD = 'Current Word Backspace',
  FULL = 'Full Backspace',
}

export enum TestMode {
  PAPER = 'Paper',
  SCREEN = 'Screen',
}

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // EXAM NAME

  @Column({ default: 'TCS' })
  screen_type: string; // TEST SCREEN (TCS / Normal / Sarkari)

  @ManyToOne(() => ResultPattern, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'result_pattern_id' })
  result_pattern: ResultPattern;

  @Column({ type: 'int', default: 10 })
  test_time_minutes: number; // TEST TIME

  @Column({
    type: 'enum',
    enum: BackspaceRule,
    default: BackspaceRule.FULL,
  })
  backspace_control: BackspaceRule; // BACKSPACE

  @Column({ default: 'yellow' })
  highlight_color: string; // HIGHLIGHTING color

  @Column({ default: true })
  highlight_word: boolean; // HIGHLIGHT Word (Y/N)

  @Column({ default: true })
  highlight_error: boolean; // HIGHLIGHT Error (Y/N)

  @Column({ default: true })
  auto_scroll: boolean; // AUTO SCROLL (Y/N)

  @Column({ type: 'int', default: 20 })
  font_size_user_screen: number; // FONT SIZE User SCREEN

  @Column({ type: 'int', default: 20 })
  font_size_test_screen: number; // FONT SIZE TEST SCREEN

  @Column({
    type: 'enum',
    enum: FontGroup,
    default: FontGroup.ENGLISH_TYPING,
  })
  font_group: FontGroup; // FONT GROUP (legacy single — kept for backward compat)

  @Column({ type: 'simple-json', nullable: true })
  font_groups: string[]; // FONT GROUP multi-select

  @Column({
    type: 'enum',
    enum: TestMode,
    default: TestMode.SCREEN,
  })
  test_paper_screen: TestMode; // TEST (PAPER/SCREEN)

  @Column({ nullable: true })
  image_url: string; // EXAM LOGO (URL format for now)

  @Column({ default: false })
  auto_submit: boolean; // Auto Submit (Y/N)

  @Column({ default: false })
  test_re_type: boolean; // TEST RE-TYPE (Y/N)

  @Column({ type: 'int', nullable: true })
  max_words_strokes: number; // MAXIMUM WORD/ STORKS

  @Column({ type: 'int', nullable: true })
  no_of_words_strokes: number; // NO. OF WORD/STROKS

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
