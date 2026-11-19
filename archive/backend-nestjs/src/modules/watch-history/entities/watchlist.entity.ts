import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Profile } from '../../users/entities/profile.entity';
import { Content } from '../../content/entities/content.entity';

@Entity('watchlist')
@Unique(['profileId', 'contentId'])
export class Watchlist {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  userId?: any;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'profile_id', type: 'bigint', nullable: true })
  profileId: any;

  @ManyToOne(() => Content, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: false })
  contentId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  get addedAt(): Date {
    return this.createdAt;
  }
  set addedAt(val: Date) {
    this.createdAt = val;
  }
}
