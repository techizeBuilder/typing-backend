import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Admin settings for one of the built-in font groups (FontGroup enum). The
// groups themselves are fixed: they drive the typing engine's keyboard handling
// and grading. Rows only exist once an admin edits a group; missing rows mean
// "active, no description". Table created by SchemaSyncService.
@Entity('font_group_settings')
export class FontGroupSetting {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  font_group: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  preview_text: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
