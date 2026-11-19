import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('ad_revenue')
@Index(['providerCode', 'contentId', 'date'], { unique: true })
export class AdRevenue {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'provider_code', type: 'varchar', length: 50, default: 'GAM' })
  providerCode: string;

  @Column({ name: 'content_id', type: 'bigint' })
  contentId: number;

  @Column({ name: 'date', type: 'date' })
  date: string;

  @Column({ name: 'impressions_count', type: 'bigint', default: 0 })
  impressionsCount: number;

  @Column({ name: 'completed_views_count', type: 'bigint', default: 0 })
  completedViewsCount: number;

  @Column({ name: 'clicks_count', type: 'bigint', default: 0 })
  clicksCount: number;

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

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'ESTIMATED' })
  status: string; // 'ESTIMATED', 'FINALIZED', 'RECONCILED'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

