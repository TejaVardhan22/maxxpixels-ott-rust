import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ad_sessions')
export class AdSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'session_token', type: 'varchar', length: 150, unique: true })
  @Index('idx_ad_sessions_token')
  sessionToken: string;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId?: number;

  @Column({ name: 'content_id', type: 'bigint' })
  @Index('idx_ad_sessions_content')
  contentId: number;

  @Column({ name: 'episode_id', type: 'bigint', nullable: true })
  episodeId?: number;

  @Column({ name: 'device_type', type: 'varchar', length: 50, default: 'WEB' })
  deviceType: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 100, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ name: 'ad_tag_url', type: 'text', nullable: true })
  adTagUrl?: string;

  @Column({ name: 'is_eligible', type: 'boolean', default: true })
  isEligible: boolean;

  @Column({ name: 'ineligibility_reason', type: 'varchar', length: 100, nullable: true })
  ineligibilityReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

