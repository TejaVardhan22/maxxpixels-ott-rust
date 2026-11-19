import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Content } from '../../content/entities/content.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('content_purchases')
export class ContentPurchase {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @ManyToOne(() => Content, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: false })
  contentId: number;

  @Column({ name: 'tvod_product_id', type: 'bigint', nullable: true })
  tvodProductId: number;

  @Column({ name: 'purchase_type', type: 'varchar', default: 'RENT', nullable: true })
  purchaseType: string;

  @Column({
    name: 'price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  price: number;

  @Column({
    name: 'amount_paid',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: numericTransformer,
  })
  amountPaid: number;

  @Column({ name: 'currency', type: 'varchar', length: 500, default: 'INR', nullable: true })
  currency: string;

  @Column({ name: 'payment_id', type: 'varchar', length: 500, nullable: true })
  paymentId: string;

  @Column({ name: 'status', type: 'varchar', length: 500, default: 'ACTIVE', nullable: true })
  status: string;

  @Column({ name: 'purchased_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  purchasedAt: Date;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ name: 'first_watched_at', type: 'timestamptz', nullable: true })
  firstWatchedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  syncFields() {
    if (this.price === undefined || this.price === null) {
      this.price = this.amountPaid ?? 0;
    }
    if (this.amountPaid === undefined || this.amountPaid === null) {
      this.amountPaid = this.price ?? 0;
    }
    if (!this.validUntil && this.expiresAt) {
      this.validUntil = this.expiresAt;
    }
    if (!this.expiresAt && this.validUntil) {
      this.expiresAt = this.validUntil;
    }
  }
}
