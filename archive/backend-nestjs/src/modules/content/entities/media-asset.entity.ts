import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'asset_id', type: 'varchar', length: 100, unique: true })
  assetId: string;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId: number;

  @Column({ name: 'episode_id', type: 'bigint', nullable: true })
  episodeId: number;

  @Column({ name: 'manifest_url', type: 'varchar', length: 500, nullable: true })
  manifestUrl: string;

  @Column({ name: 'source_url', type: 'varchar', length: 500, nullable: true })
  sourceUrl: string;

  @Column({ name: 'master_playlist_url', type: 'varchar', length: 500, nullable: true })
  masterPlaylistUrl: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'READY' })
  status: string;

  @Column({ name: 'drm_protected', type: 'boolean', default: false })
  drmProtected: boolean;

  @Column({ name: 'original_file_name', type: 'varchar', length: 500, nullable: true })
  originalFileName: string;

  @Column({ name: 's3_source_key', type: 'varchar', length: 500, nullable: true })
  s3SourceKey: string;

  @Column({ name: 'encryption_type', type: 'varchar', length: 500, default: 'AES-128', nullable: true })
  encryptionType: string;

  @Column({ name: 'drm_key_id', type: 'varchar', length: 500, nullable: true })
  drmKeyId: string;

  @Column({ name: 'transcode_status', type: 'varchar', length: 500, default: 'COMPLETED', nullable: true })
  transcodeStatus: string;

  @Column({ name: 'resolutions', type: 'varchar', length: 500, nullable: true })
  resolutions: string;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
