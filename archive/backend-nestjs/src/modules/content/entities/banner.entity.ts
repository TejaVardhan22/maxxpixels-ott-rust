import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Content } from './content.entity';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  subtitle?: string;

  @Column({ name: 'image_url', type: 'varchar', nullable: false })
  imageUrl: string;

  get mobileImageUrl(): string {
    return this.imageUrl;
  }
  set mobileImageUrl(val: string) {
    if (val && !this.imageUrl) this.imageUrl = val;
  }

  trailerUrl?: string;

  get targetUrl(): string {
    return this.actionUrl || '';
  }
  set targetUrl(val: string) {
    this.actionUrl = val;
  }

  @ManyToOne(() => Content, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId: number;

  @Column({ name: 'action_url', type: 'varchar', nullable: true })
  actionUrl: string;

  placement?: string;

  pageSlug?: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  startTime?: Date;

  endTime?: Date;
}
