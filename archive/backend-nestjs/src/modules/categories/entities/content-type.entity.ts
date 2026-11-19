import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('content_types')
export class ContentType {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title', type: 'varchar', unique: true, nullable: true })
  title: string;

  get name(): string {
    return this.title;
  }
  set name(val: string) {
    this.title = val;
  }

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  description?: string;

  iconUrl?: string;

  displayOrder?: number;

  isActive?: boolean;
}

