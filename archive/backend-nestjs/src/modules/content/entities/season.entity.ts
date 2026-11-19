import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Series } from './series.entity';
import { Episode } from './episode.entity';

@Entity('seasons')
export class Season {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Series, (series) => series.seasons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series: Series;

  @Column({ name: 'series_id', type: 'bigint', nullable: false })
  seriesId: number;

  @Column({ name: 'season_number', type: 'int', nullable: false })
  seasonNumber: number;

  @Column({ name: 'title', type: 'varchar', nullable: true })
  title: string;

  @Column({ name: 'synopsis', type: 'text', nullable: true })
  synopsis: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'poster_url', type: 'varchar', nullable: true })
  posterUrl: string;

  @Column({ name: 'release_year', type: 'int', nullable: true })
  releaseYear: number;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Episode, (episode) => episode.season, { eager: true, cascade: true })
  episodes: Episode[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
