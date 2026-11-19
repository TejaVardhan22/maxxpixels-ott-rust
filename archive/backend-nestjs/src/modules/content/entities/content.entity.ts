import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { ContentType } from '../../categories/entities/content-type.entity';
import { Genre } from '../../categories/entities/genre.entity';
import { Category } from '../../categories/entities/category.entity';
import { Language } from '../../languages/entities/language.entity';
import { ContentCast } from '../../categories/entities/content-cast.entity';
import { TvodProduct } from '../../subscriptions/entities/tvod-product.entity';
import { DrmRule } from './drm-rule.entity';
import { Movie } from './movie.entity';
import { Series } from './series.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('contents')
@Index('idx_contents_status', ['status'])
@Index('idx_contents_type_status', ['contentTypeId', 'status'])
@Index('idx_contents_lang_code', ['originalLanguageCode'])
@Index('idx_contents_created_at', ['createdAt'])
export class Content {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'short_description', type: 'varchar', length: 500, nullable: true })
  shortDescription: string;

  @ManyToOne(() => ContentType, { eager: true, nullable: true })
  @JoinColumn({ name: 'content_type_id' })
  contentType: ContentType;

  @Column({ name: 'content_type_id', type: 'bigint', nullable: true })
  contentTypeId: number;

  @Column({ name: 'content_type', type: 'varchar', length: 50, nullable: true })
  contentTypeString: string;

  get type(): string {
    return this.contentTypeString || 'MOVIE';
  }
  set type(val: string) {
    this.contentTypeString = val;
  }

  get accessType(): string {
    return this.isPremium ? 'PREMIUM' : 'FREE';
  }
  set accessType(val: string) {
    this.isPremium = val === 'PREMIUM';
  }

  @Column({ name: 'release_year', type: 'int', nullable: true })
  releaseYear: number;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string;

  @Column({ name: 'age_rating', type: 'varchar', default: 'U/A 13+', nullable: true })
  ageRating: string;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ name: 'poster_url', type: 'varchar', nullable: true })
  posterUrl: string;

  get backdropUrl(): string {
    return this.landscapeImageUrl;
  }
  set backdropUrl(val: string) {
    this.landscapeImageUrl = val;
  }

  @Column({ name: 'landscape_image_url', type: 'varchar', nullable: true })
  landscapeImageUrl: string;

  get bannerImageUrl(): string {
    return this.landscapeImageUrl;
  }
  set bannerImageUrl(val: string) {
    this.landscapeImageUrl = val;
  }

  @Column({ name: 'trailer_url', type: 'varchar', nullable: true })
  trailerUrl: string;

  @Column({ name: 'original_language_code', type: 'varchar', nullable: true })
  originalLanguageCode: string;

  get imdbRating(): number {
    return 0;
  }
  set imdbRating(val: number) {}

  @Column({ name: 'status', type: 'varchar', default: 'DRAFT', nullable: false })
  status: string;

  @Column({ name: 'is_premium', type: 'boolean', default: true })
  isPremium: boolean;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  get isTrending(): boolean {
    return this.isFeatured;
  }
  set isTrending(val: boolean) {
    this.isFeatured = val;
  }

  isOriginal?: boolean;

  @Column({ name: 'monetization', type: 'varchar', default: 'AVOD', nullable: true })
  monetization: string;

  @Column({ name: 'view_count', type: 'bigint', default: 0, nullable: true })
  viewCount: number;

  @Column({ name: 'producer_id', type: 'bigint', nullable: true })
  producerId: number;

  drmRuleId?: number;
  drmRule?: any;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date;

  @OneToOne(() => Movie, (movie) => movie.content, { eager: true, cascade: true })
  movie: Movie;

  series?: any;

  @ManyToMany(() => Genre, { eager: true })
  @JoinTable({
    name: 'content_genres',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: Genre[];

  @ManyToMany(() => Category, { eager: true })
  @JoinTable({
    name: 'content_categories',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @ManyToMany(() => Language, { eager: true })
  @JoinTable({
    name: 'content_languages',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'language_code', referencedColumnName: 'code' },
  })
  languages: Language[];

  castMembers?: any[];

  tvodProducts?: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
