import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PaymentOrder } from './payment-order.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('payments')
@Index('idx_payments_status', ['status'])
@Index('idx_payments_created_at', ['createdAt'])
export class Payment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId: any;

  @ManyToOne(() => PaymentOrder, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'payment_order_id' })
  paymentOrder: PaymentOrder;

  @Column({ name: 'payment_order_id', type: 'bigint', nullable: true })
  paymentOrderId: number;

  @Column({ name: 'provider', type: 'varchar', length: 500, nullable: true })
  provider: string;

  @Column({ name: 'provider_order_id', type: 'varchar', length: 500, nullable: true })
  providerOrderId: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, unique: true, nullable: true })
  transactionId: string;

  @Column({ name: 'provider_payment_id', type: 'varchar', length: 100, nullable: true })
  providerPaymentId: string;

  @Column({ name: 'provider_signature', type: 'varchar', length: 500, nullable: true })
  providerSignature: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod: string;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  taxAmount: number;

  @Column({
    name: 'refunded_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  refundedAmount: number;

  @Column({ name: 'currency', type: 'varchar', length: 500, default: 'INR', nullable: true })
  currency: string;

  @Column({ name: 'status', type: 'varchar', length: 20, nullable: false })
  status: string;

  @Column({ name: 'error_code', type: 'varchar', length: 500, nullable: true })
  errorCode: string;

  @Column({ name: 'error_description', type: 'text', nullable: true })
  errorDescription: string;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
