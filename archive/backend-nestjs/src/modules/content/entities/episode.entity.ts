import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Season } from './season.entity';

@Entity('episodes')
export class Episode {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Season, (season) => season.episodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'season_id' })
  season: Season;

  @Column({ name: 'season_id', type: 'bigint', nullable: false })
  seasonId: number;

  @Column({ name: 'episode_number', type: 'int', nullable: false })
  episodeNumber: number;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  @Column({ name: 'synopsis', type: 'text', nullable: true })
  synopsis: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'duration_minutes', type: 'int', default: 30, nullable: true })
  durationMinutes: number;

  @Column({ name: 'duration_seconds', type: 'int', default: 1800, nullable: false })
  durationSeconds: number;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'video_asset_id', type: 'varchar', nullable: true })
  videoAssetId: string;

  @Column({ name: 'video_url', type: 'varchar', nullable: true })
  videoUrl: string;

  @Column({ name: 'bunny_video_guid', type: 'varchar', nullable: true })
  bunnyVideoGuid: string;

  @Column({ name: 'access_type', type: 'varchar', default: 'PREMIUM', nullable: true })
  accessType: string;

  @Column({ name: 'is_free_preview', type: 'boolean', default: false })
  isFreePreview: boolean;

  @Column({ name: 'status', type: 'varchar', default: 'PUBLISHED', nullable: true })
  status: string;

  @Column({ name: 'is_premium', type: 'boolean', default: true })
  isPremium: boolean;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
