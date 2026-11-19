import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_interactions')
@Index('idx_ui_user_created', ['userId', 'createdAt'])
@Index('idx_ui_content_type', ['contentId', 'interactionType'])
@Index('idx_ui_created_at', ['createdAt'])
export class UserInteraction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId: any;

  @Column({ name: 'profile_id', type: 'bigint', nullable: true })
  profileId: any;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId: number;

  @Column({ name: 'interaction_type', type: 'varchar', length: 50, nullable: false })
  interactionType: string;

  ratingValue?: number;

  @Column({ name: 'duration_seconds', type: 'int', default: 0, nullable: true })
  durationSeconds: number;

  get watchDurationSeconds(): number {
    return this.durationSeconds;
  }
  set watchDurationSeconds(val: number) {
    this.durationSeconds = val;
  }

  countryCode?: string;

  @Column({ name: 'metadata', type: 'varchar', length: 1000, nullable: true })
  metadata: string;

  ipAddress?: string;

  @Column({ name: 'device_type', type: 'varchar', length: 50, nullable: true })
  deviceType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
