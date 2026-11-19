import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('legal_pages')
export class LegalPage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  @Column({ name: 'content', type: 'text', nullable: false })
  content: string;

  version?: string;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished: boolean;

  get isActive(): boolean {
    return this.isPublished;
  }
  set isActive(val: boolean) {
    this.isPublished = val;
  }

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
