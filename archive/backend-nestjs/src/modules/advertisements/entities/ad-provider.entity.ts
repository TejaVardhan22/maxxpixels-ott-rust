import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AdProviderConfig } from './ad-provider-config.entity';

export enum AdProviderType {
  VIDEO_VAST = 'VIDEO_VAST',
  MOBILE_SDK = 'MOBILE_SDK',
  OPEN_BIDDING = 'OPEN_BIDDING',
  DIRECT = 'DIRECT',
}

export enum AdProviderStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

@Entity('ad_providers')
export class AdProvider {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'code', type: 'varchar', length: 50, unique: true })
  code: string; // 'GAM', 'ADMOB', 'INMOBI', 'DIRECT'

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 50,
    default: AdProviderType.VIDEO_VAST,
  })
  type: AdProviderType;

  @Column({ name: 'network_code', type: 'varchar', length: 100, nullable: true })
  networkCode?: string; // GAM Network Code e.g. '21775744923'

  @Column({ name: 'publisher_id', type: 'varchar', length: 100, nullable: true })
  publisherId?: string; // e.g. 'pub-2191993313473081'

  @Column({ name: 'app_id', type: 'varchar', length: 150, nullable: true })
  appId?: string; // AdMob App ID e.g. 'ca-app-pub-2191993313473081~5839116549'

  @Column({ name: 'account_id', type: 'varchar', length: 100, nullable: true })
  accountId?: string; // InMobi Account ID

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_bidding_enabled', type: 'boolean', default: false })
  isBiddingEnabled: boolean; // InMobi Open Bidding via GAM / AdMob

  @Column({
    name: 'status',
    type: 'varchar',
    length: 50,
    default: AdProviderStatus.ACTIVE,
  })
  status: AdProviderStatus;

  @OneToMany(() => AdProviderConfig, (config) => config.provider, { cascade: true })
  configurations: AdProviderConfig[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

