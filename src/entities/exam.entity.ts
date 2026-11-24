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

  // Region / state the exam belongs to (Delhi, UP, …) — drives the student-side
  // exam pattern filter. Null = not set (shown under "All Exam" only).
  @Column({ type: 'varchar', length: 40, nullable: true })
  region: string | null;

  // Optional official rules / instructions PDF (uploaded via POST /exams/:id/rules-pdf)
  @Column({ type: 'varchar', nullable: true })
  rules_pdf_url: string | null;

  // Info for students (8.18, optional)
  @Column({ type: 'varchar', length: 150, nullable: true })
  display_title: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  conducted_by: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  mistake_policy: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  exam_level: string | null;

  // Steno exam cards: comma-separated chips ("840 Words, All Speeds") and the PRO LEVEL ribbon
  @Column({ type: 'varchar', length: 300, nullable: true })
  card_tags: string | null;

  @Column({ default: false })
  is_pro_level: boolean;

  // Passing criteria and word/stroke limits per language. Null = the Result Pattern's
  // criteria and the limits below. { english|hindi: { enabled, qualify_on,
  // required_speed, required_accuracy, min, max } }
  @Column({ type: 'jsonb', nullable: true })
  language_rules: Record<string, any> | null;

  // Which result components students see. Null = the Result Pattern's show_* flags.
  @Column({ type: 'jsonb', nullable: true })
  result_components: Record<string, boolean> | null;

  // formatting = passage shows its tabs and line breaks; normal = one running text
  @Column({ type: 'varchar', length: 12, default: 'formatting' })
  test_format: string;

  // Instructions ("Exam Rule") uploaded as TXT; a PDF is kept in rules_pdf_url
  @Column({ type: 'text', nullable: true })
  instructions_text: string | null;

  // Inactive exams are hidden from students without deleting them or their results
  @Column({ default: true })
  is_active: boolean;

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
