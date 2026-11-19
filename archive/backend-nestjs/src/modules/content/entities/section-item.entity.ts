import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Section } from './section.entity';
import { Content } from './content.entity';

@Entity('section_items')
export class SectionItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ name: 'section_id', type: 'bigint', nullable: false })
  sectionId: number;

  @ManyToOne(() => Content, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: false })
  contentId: number;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}

