import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AdFormat {
  PRE_ROLL = 'PRE_ROLL',
  MID_ROLL = 'MID_ROLL',
  POST_ROLL = 'POST_ROLL',
  BANNER = 'BANNER',
  INTERSTITIAL = 'INTERSTITIAL',
  REWARDED = 'REWARDED',
  NATIVE = 'NATIVE',
}

@Entity('ad_placements')
export class AdPlacement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'code', type: 'varchar', length: 100, unique: true })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'format',
    type: 'varchar',
    length: 50,
    default: AdFormat.PRE_ROLL,
  })
  format: AdFormat;

  @Column({ name: 'platform', type: 'varchar', length: 50, default: 'ALL' })
  platform: string; // 'ALL', 'WEB', 'MOBILE', 'TV'

  @Column({ name: 'cue_point_seconds', type: 'int', default: 0 })
  cuePointSeconds: number; // 0 for pre-roll, >0 for mid-roll

  @Column({ name: 'max_duration_seconds', type: 'int', default: 30 })
  maxDurationSeconds: number;

  @Column({ name: 'skip_offset_seconds', type: 'int', default: 5 })
  skipOffsetSeconds: number;

  @Column({ name: 'frequency_cap_per_hour', type: 'int', default: 4 })
  frequencyCapPerHour: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

