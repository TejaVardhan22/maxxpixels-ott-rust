import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Content } from './content.entity';

@Entity('movies')
export class Movie {
  @PrimaryColumn({ name: 'id', type: 'bigint' })
  id: number;

  @OneToOne(() => Content, (content) => content.movie, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  content: Content;

  @Column({ name: 'video_asset_id', type: 'varchar', nullable: true })
  videoAssetId: string;

  get contentId(): number {
    return this.id;
  }
  set contentId(val: number) {
    this.id = val;
  }

  get videoUrl(): string {
    return this.videoAssetId || '';
  }
  set videoUrl(val: string) {
    this.videoAssetId = val;
  }

  get streamUrl(): string {
    return this.videoAssetId || '';
  }
  set streamUrl(val: string) {
    this.videoAssetId = val;
  }

  get hlsUrl(): string {
    return this.videoAssetId || '';
  }
  set hlsUrl(val: string) {
    this.videoAssetId = val;
  }

  get dashUrl(): string {
    return this.videoAssetId || '';
  }
  set dashUrl(val: string) {
    this.videoAssetId = val;
  }

  get bunnyVideoGuid(): string {
    if (!this.videoAssetId) return '';
    const m = this.videoAssetId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m ? m[0] : this.videoAssetId;
  }
  set bunnyVideoGuid(val: string) {
    if (val && !this.videoAssetId) {
      this.videoAssetId = val;
    }
  }

  @Column({ name: 'duration_minutes', type: 'integer', nullable: true })
  durationMinutes?: number;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds?: number;

  @Column({ name: 'director', type: 'varchar', length: 500, nullable: true })
  director?: string;

  @Column({ name: 'writers', type: 'varchar', length: 500, nullable: true })
  writers?: string;

  @Column({ name: 'production_house', type: 'varchar', length: 500, nullable: true })
  productionHouse?: string;

  @Column({ name: 'country_of_origin', type: 'varchar', length: 500, nullable: true })
  countryOfOrigin?: string;

  @Column({ name: 'is_tvod_available', type: 'boolean', default: false })
  isTvodAvailable?: boolean;

  @Column({ name: 'drm_enabled', type: 'boolean', default: false })
  drmEnabled?: boolean;
}

