import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Page } from './page.entity';
import { SectionItem } from './section-item.entity';

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Page, (page) => page.sections, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @Column({ name: 'page_id', type: 'bigint', nullable: true })
  pageId: number;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  @Column({ name: 'subtitle', type: 'varchar', nullable: true })
  subtitle: string;

  @Column({ name: 'type', type: 'varchar', default: 'CURATED', nullable: true })
  type: string;

  @Column({ name: 'section_type', type: 'varchar', default: 'CURATED', nullable: true })
  sectionType: string;

  @Column({ name: 'layout', type: 'varchar', default: 'PORTRAIT', nullable: true })
  layout: string;

  @Column({ name: 'layout_style', type: 'varchar', default: 'HORIZONTAL_POSTER', nullable: true })
  layoutStyle: string;

  @Column({ name: 'content_type_filter', type: 'varchar', nullable: true })
  contentTypeFilter: string;

  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId: number;

  @Column({ name: 'genre_id', type: 'bigint', nullable: true })
  genreId: number;

  @Column({ name: 'language_code', type: 'varchar', nullable: true })
  languageCode: string;

  @Column({ name: 'auto_fetch_limit', type: 'int', default: 12 })
  autoFetchLimit: number;

  @Column({ name: 'rule_json', type: 'text', nullable: true })
  ruleJson: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => SectionItem, (item) => item.section, { eager: true })
  items: SectionItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
