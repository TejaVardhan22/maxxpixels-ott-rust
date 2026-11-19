import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Content } from '../../content/entities/content.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('tvod_products')
export class TvodProduct {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Content, (content) => content.tvodProducts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: false })
  contentId: number;

  @Column({ name: 'purchase_type', type: 'varchar', default: 'RENT', nullable: false })
  purchaseType: string;

  @Column({
    name: 'price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: numericTransformer,
  })
  price: number;

  @Column({ name: 'currency', type: 'varchar', default: 'INR' })
  currency: string;

  @Column({ name: 'validity_hours', type: 'int', default: 48 })
  validityHours: number;

  @Column({ name: 'rental_duration_hours', type: 'int', default: 48 })
  rentalDurationHours: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
