import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AdEventType {
  REQUEST = 'REQUEST',
  IMPRESSION = 'IMPRESSION',
  START = 'START',
  FIRST_QUARTILE = 'FIRST_QUARTILE',
  MIDPOINT = 'MIDPOINT',
  THIRD_QUARTILE = 'THIRD_QUARTILE',
  COMPLETE = 'COMPLETE',
  CLICK = 'CLICK',
  SKIP = 'SKIP',
  ERROR = 'ERROR',
}

@Entity('ad_events')
export class AdEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'session_token', type: 'varchar', length: 150 })
  @Index('idx_ad_events_session')
  sessionToken: string;

  @Column({ name: 'campaign_id', type: 'bigint', nullable: true })
  campaignId?: number;

  @Column({ name: 'provider_code', type: 'varchar', length: 50, default: 'GAM' })
  providerCode: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 50,
  })
  eventType: AdEventType;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId?: number;

  @Column({ name: 'producer_id', type: 'bigint', nullable: true })
  producerId?: number;

  @Column({ name: 'dedup_key', type: 'varchar', length: 120, unique: true })
  @Index('idx_ad_events_dedup', { unique: true })
  dedupKey: string;

  @Column({ name: 'revenue_paise', type: 'int', default: 0 })
  revenuePaise: number;

  @Column({ name: 'metadata', type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

