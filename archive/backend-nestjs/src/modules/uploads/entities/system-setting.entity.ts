import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'setting_key', type: 'varchar', unique: true, nullable: false })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text', nullable: true })
  settingValue: string;

  category?: string;

  settingGroup?: string;

  description?: string;

  isSecret?: boolean;

  isPublic?: boolean;

  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
