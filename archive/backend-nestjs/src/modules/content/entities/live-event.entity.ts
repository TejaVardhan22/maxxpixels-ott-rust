import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LiveChannel } from './live-channel.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('live_events')
export class LiveEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'poster_url', type: 'varchar', nullable: true })
  posterUrl: string;

  @Column({ name: 'hls_stream_url', type: 'varchar', nullable: true })
  hlsStreamUrl: string;

  @Column({ name: 'stream_url', type: 'varchar', nullable: true })
  streamUrl: string;

  @ManyToOne(() => LiveChannel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'channel_id' })
  channel: LiveChannel;

  @Column({ name: 'channel_id', type: 'bigint', nullable: true })
  channelId: number;

  @Column({ name: 'scheduled_start', type: 'timestamptz', nullable: true })
  scheduledStart: Date;

  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz', nullable: true })
  scheduledEnd: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({ name: 'status', type: 'varchar', default: 'UPCOMING', nullable: true })
  status: string;

  @Column({ name: 'access_type', type: 'varchar', default: 'PREMIUM', nullable: true })
  accessType: string;

  @Column({ name: 'is_premium', type: 'boolean', default: true })
  isPremium: boolean;

  @Column({ name: 'is_ppv', type: 'boolean', default: false })
  isPpv: boolean;

  @Column({
    name: 'ppv_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  ppvPrice: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
