import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Profile } from '../../users/entities/profile.entity';
import { Content } from '../../content/entities/content.entity';
import { Episode } from '../../content/entities/episode.entity';

@Entity('watch_history')
@Unique(['profileId', 'contentId', 'episodeId'])
@Index('idx_wh_profile_completed_last', ['profileId', 'completed', 'lastWatchedAt'])
@Index('idx_wh_content_id', ['contentId'])
@Index('idx_wh_last_watched', ['lastWatchedAt'])
export class WatchHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  userId?: any;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'profile_id', type: 'bigint', nullable: true })
  profileId: any;

  @ManyToOne(() => Content, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId: number;

  episode?: any;

  @Column({ name: 'episode_id', type: 'bigint', nullable: true })
  episodeId: number;

  @Column({ name: 'position_seconds', type: 'int', default: 0, nullable: false })
  positionSeconds: number;

  get watchedSeconds(): number {
    return this.positionSeconds;
  }
  set watchedSeconds(val: number) {
    this.positionSeconds = val;
  }

  get watchedDurationSeconds(): number {
    return this.positionSeconds;
  }
  set watchedDurationSeconds(val: number) {
    this.positionSeconds = val;
  }

  @Column({ name: 'duration_seconds', type: 'int', default: 0, nullable: false })
  durationSeconds: number;

  get totalDurationSeconds(): number {
    return this.durationSeconds;
  }
  set totalDurationSeconds(val: number) {
    this.durationSeconds = val;
  }

  @Column({ name: 'percentage', type: 'numeric', default: 0, nullable: true })
  percentage: number;

  @Column({ name: 'completed', type: 'boolean', default: false })
  completed: boolean;

  get isCompleted(): boolean {
    return this.completed;
  }
  set isCompleted(val: boolean) {
    this.completed = val;
  }

  @Column({ name: 'last_watched_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastWatchedAt: Date;
}
