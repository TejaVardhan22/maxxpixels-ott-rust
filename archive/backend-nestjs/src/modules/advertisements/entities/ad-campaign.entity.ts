import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ad_campaigns')
export class AdCampaign {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'campaign_name', type: 'varchar', nullable: true })
  campaignName: string;

  get name(): string {
    return this.campaignName;
  }
  set name(val: string) {
    this.campaignName = val;
  }

  @Column({ name: 'advertiser_name', type: 'varchar', nullable: true })
  advertiserName: string;

  @Column({ name: 'vast_tag_url', type: 'varchar', length: 1000, nullable: true })
  vastTagUrl: string;

  @Column({ name: 'video_url', type: 'varchar', length: 1000, nullable: true })
  videoUrl: string;

  @Column({ name: 'stream_video_id', type: 'varchar', length: 200, nullable: true })
  streamVideoId: string;

  get bunnyVideoGuid(): string {
    return this.streamVideoId;
  }
  set bunnyVideoGuid(val: string) {
    this.streamVideoId = val;
  }

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 1000, nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'ad_break_type', type: 'varchar', default: 'PRE_ROLL', nullable: true })
  adBreakType: string;

  get adType(): string {
    return this.adBreakType;
  }
  set adType(val: string) {
    this.adBreakType = val;
  }

  @Column({ name: 'duration_seconds', type: 'int', default: 15, nullable: true })
  durationSeconds: number;

  skipOffsetSeconds?: number;

  targetContentType?: string;

  targetLanguage?: string;

  @Column({ name: 'cpm_rate', type: 'double precision', default: 0.0, nullable: true })
  cpmRate: number;

  get budgetAmount(): number {
    return this.totalBudget;
  }
  set budgetAmount(val: number) {
    this.totalBudget = val;
  }

  @Column({ name: 'impressions_target', type: 'bigint', default: 10000, nullable: true })
  impressionsTarget: number;

  @Column({ name: 'impressions_delivered', type: 'bigint', default: 0, nullable: true })
  impressionsDelivered: number;

  get impressionsCount(): number {
    return this.impressionsDelivered;
  }
  set impressionsCount(val: number) {
    this.impressionsDelivered = val;
  }

  clicksCount?: number;

  @Column({ name: 'total_budget', type: 'double precision', default: 0.0, nullable: true })
  totalBudget: number;

  @Column({ name: 'spent_budget', type: 'double precision', default: 0.0, nullable: true })
  spentBudget: number;

  @Column({ name: 'target_devices', type: 'varchar', default: 'ALL', nullable: true })
  targetDevices: string;

  startDate?: Date;

  endDate?: Date;

  @Column({ name: 'status', type: 'varchar', default: 'ACTIVE', nullable: true })
  status: string;

  get isActive(): boolean {
    return this.status === 'ACTIVE';
  }
  set isActive(val: boolean) {
    this.status = val ? 'ACTIVE' : 'INACTIVE';
  }

  @Column({ name: 'click_url', type: 'varchar', length: 1000, nullable: true })
  clickUrl: string;

  get clickThroughUrl(): string {
    return this.clickUrl;
  }
  set clickThroughUrl(val: string) {
    this.clickUrl = val;
  }

  @Column({ name: 'provider', type: 'varchar', default: 'BUNNY_STREAM', nullable: true })
  provider: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
