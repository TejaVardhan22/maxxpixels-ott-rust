import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AdRuleType {
  EXCLUDE_PREMIUM = 'EXCLUDE_PREMIUM',
  EXCLUDE_TVOD = 'EXCLUDE_TVOD',
  EXCLUDE_CONTENT = 'EXCLUDE_CONTENT',
  FREQUENCY_CAP = 'FREQUENCY_CAP',
  GEO_TARGETING = 'GEO_TARGETING',
}

@Entity('ad_rules')
export class AdRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'rule_type',
    type: 'varchar',
    length: 50,
    default: AdRuleType.EXCLUDE_PREMIUM,
  })
  ruleType: AdRuleType;

  @Column({ name: 'applies_to', type: 'varchar', length: 50, default: 'FREE_TIER' })
  appliesTo: string; // 'ALL', 'FREE_TIER', 'VIP_SUBSCRIBERS', 'RENTAL'

  @Column({ name: 'target_content_type', type: 'varchar', length: 50, nullable: true })
  targetContentType?: string;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId?: number;

  @Column({ name: 'target_country', type: 'varchar', length: 10, default: 'IN' })
  targetCountry: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

