import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Content } from './content.entity';
import { Season } from './season.entity';

@Entity('series')
export class Series {
  @PrimaryColumn({ name: 'id', type: 'bigint' })
  id: number;

  @OneToOne(() => Content, (content) => content.series, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  content: Content;

  @Column({ name: 'content_id', type: 'bigint', nullable: true })
  contentId?: number;

  @Column({ name: 'total_seasons', type: 'int', default: 0 })
  totalSeasons: number;

  @Column({ name: 'total_episodes', type: 'int', default: 0 })
  totalEpisodes: number;

  @Column({ name: 'is_ongoing', type: 'boolean', default: true })
  isOngoing: boolean;

  @OneToMany(() => Season, (season) => season.series, { eager: true, cascade: true })
  seasons: Season[];
}

