import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../users/entities/user.entity';
import { Plan } from '../../subscriptions/entities/plan.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('payment_orders')
export class PaymentOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'order_id', type: 'varchar', unique: true, nullable: true })
  orderId: string;

  @Column({ name: 'provider_order_id', type: 'varchar', length: 500, nullable: true })
  providerOrderId: string;

  @BeforeInsert()
  @BeforeUpdate()
  syncOrderFields() {
    if (!this.orderId) {
      this.orderId = this.providerOrderId || `order_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    if (!this.providerOrderId && this.orderId) {
      this.providerOrderId = this.orderId;
    }
    if (this.amount === undefined || this.amount === null) {
      this.amount = this.finalAmount ?? this.originalAmount ?? 0;
    }
    if (this.finalAmount === undefined || this.finalAmount === null) {
      this.finalAmount = this.amount ?? this.originalAmount ?? 0;
    }
    if (this.originalAmount === undefined || this.originalAmount === null) {
      this.originalAmount = this.amount ?? this.finalAmount ?? 0;
    }
  }

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @ManyToOne(() => Plan, { eager: true, nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ name: 'plan_id', type: 'bigint', nullable: true })
  planId: number;

  @Column({ name: 'order_type', type: 'varchar', default: 'SUBSCRIPTION', nullable: true })
  orderType: string;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId: number;

  @Column({ name: 'validity_hours', type: 'int', nullable: true })
  validityHours: number;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({
    name: 'original_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  originalAmount: number;

  @Column({ name: 'currency', type: 'varchar', default: 'INR' })
  currency: string;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  discountAmount?: number;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  taxAmount?: number;

  @Column({
    name: 'final_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  finalAmount: number;

  @Column({ name: 'coupon_code', type: 'varchar', length: 500, nullable: true })
  couponCode?: string;

  @Column({ name: 'provider', type: 'varchar', default: 'RAZORPAY', nullable: false })
  provider: string;

  @Column({ name: 'receipt_number', type: 'varchar', length: 500, nullable: true })
  receiptNumber?: string;

  @Column({ name: 'subscription_id', type: 'varchar', length: 100, nullable: true })
  subscriptionId?: string;

  @Column({ name: 'status', type: 'varchar', default: 'CREATED' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt?: Date;
}
