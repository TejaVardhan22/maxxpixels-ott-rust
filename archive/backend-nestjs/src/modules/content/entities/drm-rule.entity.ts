import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('drm_rules')
export class DrmRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  name?: string;

  provider?: string;

  @Column({ name: 'drm_type', type: 'varchar', nullable: true })
  drmType: string;

  widevineLicenseUrl?: string;

  fairplayLicenseUrl?: string;

  fairplayCertificateUrl?: string;

  playreadyLicenseUrl?: string;

  @Column({ name: 'security_level', type: 'varchar', default: 'L1', nullable: true })
  securityLevel: string;

  hdcpLevel?: string;

  @Column({ name: 'license_type', type: 'varchar', nullable: true })
  licenseType: string;

  persistentLicense?: boolean;

  licenseDurationSeconds?: number;

  playbackDurationSeconds?: number;

  blockScreenRecording?: boolean;

  blockRootedDevices?: boolean;

  dynamicWatermarking?: boolean;

  concurrentStreamLimit?: number;

  @Column({ name: 'enforce_hdcp22', type: 'boolean', default: true })
  enforceHdcp22: boolean;

  @Column({ name: 'dynamic_key_rotation', type: 'boolean', default: true })
  dynamicKeyRotation: boolean;

  @Column({ name: 'key_rotation_interval_minutes', type: 'int', default: 15 })
  keyRotationIntervalMinutes: number;

  @Column({ name: 'invisible_watermarking', type: 'boolean', default: true })
  invisibleWatermarking: boolean;

  @Column({ name: 'status', type: 'varchar', default: 'ACTIVE', nullable: true })
  status: string;

  get isActive(): boolean {
    return this.status === 'ACTIVE';
  }
  set isActive(val: boolean) {
    this.status = val ? 'ACTIVE' : 'INACTIVE';
  }

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
