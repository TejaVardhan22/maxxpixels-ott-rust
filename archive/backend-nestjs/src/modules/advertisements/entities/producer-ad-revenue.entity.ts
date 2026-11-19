import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('producer_ad_revenue')
@Index(['producerId', 'contentId', 'billingPeriod'], { unique: true })
export class ProducerAdRevenue {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'producer_id', type: 'bigint' })
  producerId: number;

  @Column({ name: 'content_id', type: 'bigint' })
  contentId: number;

  @Column({ name: 'episode_id', type: 'bigint', nullable: true })
  episodeId?: number;

  @Column({ name: 'billing_period', type: 'varchar', length: 20 }) // e.g. '2026-10'
  billingPeriod: string;

  @Column({ name: 'total_impressions', type: 'bigint', default: 0 })
  totalImpressions: number;

  @Column({
    name: 'gross_revenue',
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0.0,
    transformer: numericTransformer,
  })
  grossRevenue: number;

  @Column({
    name: 'net_revenue',
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0.0,
    transformer: numericTransformer,
  })
  netRevenue: number;

  @Column({
    name: 'producer_share_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 60.0, // 60% Producer share
    transformer: numericTransformer,
  })
  producerSharePercent: number;

  @Column({
    name: 'producer_amount',
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0.0,
    transformer: numericTransformer,
  })
  producerAmount: number;

  @Column({
    name: 'platform_share_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 40.0, // 40% MaxxPixels share
    transformer: numericTransformer,
  })
  platformSharePercent: number;

  @Column({
    name: 'platform_amount',
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0.0,
    transformer: numericTransformer,
  })
  platformAmount: number;

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'PENDING' })
  status: string; // 'PENDING', 'APPROVED', 'PAID'

  @Column({ name: 'settlement_date', type: 'timestamptz', nullable: true })
  settlementDate?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

