import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Plan } from './plan.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('subscriptions')
@Index('idx_sub_user_status_end', ['userId', 'status', 'endDate'])
@Index('idx_sub_status', ['status'])
export class Subscription {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @ManyToOne(() => Plan, { eager: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ name: 'plan_id', type: 'bigint', nullable: false })
  planId: number;

  @Column({ name: 'status', type: 'varchar', default: 'ACTIVE', nullable: false })
  status: string;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: false })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: false })
  endDate: Date;

  @Column({ name: 'auto_renew', type: 'boolean', default: true })
  autoRenew: boolean;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'razorpay_subscription_id', type: 'varchar', length: 100, nullable: true })
  razorpaySubscriptionId?: string;

  @Column({ name: 'payment_gateway_sub_id', type: 'varchar', length: 500, nullable: true })
  paymentGatewaySubId?: string;

  @Column({ name: 'payment_id', type: 'varchar', length: 500, nullable: true })
  paymentId?: string;

  @Column({ name: 'razorpay_customer_id', type: 'varchar', length: 100, nullable: true })
  razorpayCustomerId?: string;

  @Column({ name: 'autopay_enabled', type: 'boolean', default: false })
  autopayEnabled: boolean;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  amount?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
