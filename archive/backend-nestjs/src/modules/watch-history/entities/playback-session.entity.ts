import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Profile } from '../../users/entities/profile.entity';
import { Content } from '../../content/entities/content.entity';

@Entity('playback_sessions')
@Index('idx_pb_status_heartbeat', ['status', 'lastHeartbeat'])
@Index('idx_pb_user_status', ['userId', 'status'])
@Index('idx_pb_started_at', ['startedAt'])
export class PlaybackSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'session_id', type: 'varchar', unique: true, nullable: true })
  sessionId: string;

  get sessionToken(): string {
    return this.sessionId;
  }
  set sessionToken(val: string) {
    this.sessionId = val;
  }

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'profile_id', type: 'bigint', nullable: true })
  profileId: any;

  @Column({ name: 'device_id', type: 'varchar', nullable: false })
  deviceId: string;

  @Column({ name: 'device_type', type: 'varchar', nullable: true })
  deviceType: string;

  @ManyToOne(() => Content, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: false })
  contentId: number;

  episodeId?: number;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ name: 'last_heartbeat', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastHeartbeat: Date;

  get lastHeartbeatAt(): Date {
    return this.lastHeartbeat;
  }
  set lastHeartbeatAt(val: Date) {
    this.lastHeartbeat = val;
  }

  @Column({ name: 'current_position_seconds', type: 'int', default: 0 })
  currentPositionSeconds: number;

  @Column({ name: 'total_duration_seconds', type: 'int', default: 0 })
  totalDurationSeconds: number;

  @Column({ name: 'status', type: 'varchar', default: 'ACTIVE' })
  status: string;

  get isActive(): boolean {
    return this.status === 'ACTIVE';
  }
  set isActive(val: boolean) {
    this.status = val ? 'ACTIVE' : 'TERMINATED';
  }

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string;
}
