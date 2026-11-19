import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'code', type: 'varchar', unique: true, nullable: false })
  code: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ name: 'discount_type', type: 'varchar', default: 'PERCENTAGE', nullable: false })
  discountType: string;

  @Column({
    name: 'discount_value',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: numericTransformer,
  })
  discountValue: number;

  @Column({
    name: 'minimum_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  minimumAmount: number;

  get minOrderAmount(): number {
    return this.minimumAmount;
  }
  set minOrderAmount(val: number) {
    this.minimumAmount = val;
  }

  @Column({
    name: 'maximum_discount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  maximumDiscount: number;

  get maxDiscountAmount(): number {
    return this.maximumDiscount;
  }
  set maxDiscountAmount(val: number) {
    this.maximumDiscount = val;
  }

  @Column({ name: 'applicable_plan_id', type: 'bigint', nullable: true })
  applicablePlanId?: number;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number;

  @Column({ name: 'usage_per_user', type: 'int', default: 1, nullable: true })
  usagePerUser: number;

  @Column({ name: 'used_count', type: 'int', default: 0, nullable: true })
  usedCount?: number;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt?: Date;
}
