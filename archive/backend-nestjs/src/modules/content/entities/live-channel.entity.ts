import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('live_channels')
export class LiveChannel {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string;

  @Column({ name: 'poster_url', type: 'varchar', nullable: true })
  posterUrl: string;

  @Column({ name: 'hls_stream_url', type: 'varchar', nullable: true })
  hlsStreamUrl: string;

  @Column({ name: 'stream_url', type: 'varchar', nullable: true })
  streamUrl: string;

  @Column({ name: 'drm_license_url', type: 'varchar', nullable: true })
  drmLicenseUrl: string;

  @Column({ name: 'category', type: 'varchar', nullable: true })
  category: string;

  @Column({ name: 'language_code', type: 'varchar', nullable: true })
  languageCode: string;

  @Column({ name: 'access_type', type: 'varchar', default: 'FREE', nullable: true })
  accessType: string;

  @Column({ name: 'channel_number', type: 'int', nullable: true })
  channelNumber: number;

  @Column({ name: 'is_live', type: 'boolean', default: true })
  isLive: boolean;

  @Column({ name: 'is_premium', type: 'boolean', default: true })
  isPremium: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
