import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Content } from '../../content/entities/content.entity';
import { Person } from './person.entity';

@Entity('content_cast')
export class ContentCast {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: false })
  contentId: number;

  @ManyToOne(() => Person, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @Column({ name: 'person_id', type: 'bigint', nullable: false })
  personId: number;

  @Column({ name: 'role_type', type: 'varchar', nullable: false })
  roleType: string;

  @Column({ name: 'character_name', type: 'varchar', nullable: true })
  characterName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}

