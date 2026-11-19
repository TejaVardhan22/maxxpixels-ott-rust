import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ name: 'code', type: 'varchar', length: 50, unique: true, nullable: true })
  code: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: numericTransformer,
  })
  price: number;

  @Column({
    name: 'discount_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  discountPrice?: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'billing_period', type: 'varchar', length: 20, default: 'MONTHLY', nullable: true })
  billingPeriod: string;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 500, nullable: true })
  billingCycle: string;

  @Column({ name: 'duration_days', type: 'int', default: 30, nullable: true })
  durationDays: number;

  @Column({ name: 'max_concurrent_streams', type: 'int', default: 1 })
  maxConcurrentStreams: number;

  @Column({ name: 'max_devices', type: 'int', default: 5 })
  maxDevices: number;

  @Column({ name: 'max_registered_devices', type: 'int', default: 5, nullable: true })
  maxRegisteredDevices: number;

  @Column({ name: 'max_profiles', type: 'int', default: 4, nullable: true })
  maxProfiles: number;

  @Column({ name: 'max_resolution', type: 'varchar', length: 20, default: '1080p' })
  maxResolution: string;

  @Column({ name: 'max_video_quality', type: 'varchar', length: 500, default: '1080p', nullable: true })
  maxVideoQuality: string;

  @Column({ name: 'ads_enabled', type: 'boolean', default: false })
  adsEnabled: boolean;

  @Column({ name: 'has_ads', type: 'boolean', default: false, nullable: true })
  hasAds: boolean;

  @Column({ name: 'downloads_enabled', type: 'boolean', default: true })
  downloadsEnabled: boolean;

  @Column({ name: 'download_allowed', type: 'boolean', default: true, nullable: true })
  downloadAllowed: boolean;

  @Column({ name: 'allow_downloads', type: 'boolean', default: true, nullable: true })
  allowDownloads: boolean;

  @Column({ name: 'is_popular', type: 'boolean', default: false, nullable: true })
  isPopular: boolean;

  @Column({ name: 'features_json', type: 'text', nullable: true })
  featuresJson?: string;

  @Column({ name: 'trial_days', type: 'int', default: 0, nullable: true })
  trialDays: number;

  @Column({ name: 'is_autopay_eligible', type: 'boolean', default: false })
  isAutopayEligible: boolean;

  @Column({ name: 'razorpay_plan_id', type: 'varchar', length: 100, nullable: true })
  razorpayPlanId?: string;

  get autopayEnabled(): boolean {
    return this.isAutopayEligible;
  }
  set autopayEnabled(val: boolean) {
    this.isAutopayEligible = val;
  }

  @Column({ name: 'single_use_only', type: 'boolean', default: false, nullable: true })
  singleUseOnly: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  get active(): boolean {
    return this.isActive;
  }
  set active(val: boolean) {
    this.isActive = val;
  }

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt?: Date;

  @BeforeInsert()
  @BeforeUpdate()
  syncFields() {
    if (!this.code && this.name) {
      this.code = this.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    }
    if (!this.billingPeriod && this.billingCycle) {
      this.billingPeriod = this.billingCycle;
    }
    if (!this.billingCycle && this.billingPeriod) {
      this.billingCycle = this.billingPeriod;
    }
    if (!this.maxResolution && this.maxVideoQuality) {
      this.maxResolution = this.maxVideoQuality;
    }
    if (!this.maxVideoQuality && this.maxResolution) {
      this.maxVideoQuality = this.maxResolution;
    }
    if (this.adsEnabled === undefined && this.hasAds !== undefined) {
      this.adsEnabled = this.hasAds;
    }
    if (this.hasAds === undefined && this.adsEnabled !== undefined) {
      this.hasAds = this.adsEnabled;
    }
    if (this.downloadsEnabled === undefined) {
      this.downloadsEnabled = this.allowDownloads ?? this.downloadAllowed ?? true;
    }
    this.allowDownloads = this.downloadsEnabled;
    this.downloadAllowed = this.downloadsEnabled;
    if (this.maxRegisteredDevices === undefined && this.maxDevices !== undefined) {
      this.maxRegisteredDevices = this.maxDevices;
    }
    if (this.durationDays === undefined || this.durationDays === null || this.durationDays <= 0) {
      this.durationDays = this.calculateDurationDays(this.billingPeriod || this.billingCycle);
    }
  }

  private calculateDurationDays(period?: string): number {
    if (!period) return 30;
    const upper = period.toUpperCase();
    if (upper.includes('DAY_') || upper.includes('DAYS_')) {
      const match = upper.match(/DAY[S]?_(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    if (upper === 'DAILY' || upper === 'DAY') return 1;
    if (upper === 'WEEKLY' || upper === 'WEEK') return 7;
    if (upper.includes('MONTH_') || upper.includes('MONTHS_')) {
      const match = upper.match(/MONTH[S]?_(\d+)/);
      if (match) return parseInt(match[1], 10) * 30;
    }
    if (upper === 'MONTHLY' || upper === 'MONTH') return 30;
    if (upper === 'QUARTERLY') return 90;
    if (upper === 'SEMI_ANNUAL') return 180;
    if (upper === 'ANNUAL' || upper === 'YEARLY' || upper === 'YEAR') return 365;
    return 30;
  }
}
