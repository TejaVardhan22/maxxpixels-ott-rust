import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: any;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @Column({ name: 'device_id', type: 'varchar', nullable: false })
  deviceId: string;

  @Column({ name: 'device_name', type: 'varchar', nullable: true })
  deviceName: string;

  @Column({ name: 'platform', type: 'varchar', default: 'ANDROID', nullable: false })
  platform: string;

  deviceType?: string;

  @Column({ name: 'device_model', type: 'varchar', nullable: true })
  deviceModel?: string;

  @Column({ name: 'os_version', type: 'varchar', nullable: true })
  osVersion: string;

  @Column({ name: 'app_version', type: 'varchar', nullable: true })
  appVersion: string;

  @Column({ name: 'fcm_token', type: 'varchar', nullable: true })
  fcmToken: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string;

  isActive?: boolean;

  @Column({ name: 'last_seen', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastSeen: Date;

  get lastActiveAt(): Date {
    return this.lastSeen;
  }
  set lastActiveAt(val: Date) {
    this.lastSeen = val;
  }

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
