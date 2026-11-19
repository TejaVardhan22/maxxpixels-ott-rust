import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Section } from './section.entity';

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name: string;

  @Column({ name: 'title', type: 'varchar', nullable: true })
  title: string;

  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string;

  @Column({ name: 'icon_url', type: 'varchar', nullable: true })
  iconUrl: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Section, (section) => section.page)
  sections: Section[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
