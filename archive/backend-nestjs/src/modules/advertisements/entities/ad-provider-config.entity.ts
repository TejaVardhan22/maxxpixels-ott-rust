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
import { AdProvider } from './ad-provider.entity';

@Entity('ad_provider_configurations')
@Index(['providerId', 'configKey', 'environment'], { unique: true })
export class AdProviderConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'provider_id', type: 'bigint' })
  providerId: number;

  @ManyToOne(() => AdProvider, (provider) => provider.configurations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'provider_id' })
  provider: AdProvider;

  @Column({ name: 'config_key', type: 'varchar', length: 150 })
  configKey: string;

  @Column({ name: 'config_value', type: 'text', nullable: true })
  configValue: string;

  @Column({ name: 'environment', type: 'varchar', length: 50, default: 'PRODUCTION' })
  environment: string;

  @Column({ name: 'is_secret', type: 'boolean', default: false })
  isSecret: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

