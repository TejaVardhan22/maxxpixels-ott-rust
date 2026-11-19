import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { Content } from '../entities/content.entity';
import { Movie } from '../entities/movie.entity';
import { Series } from '../entities/series.entity';
import { Season } from '../entities/season.entity';
import { Episode } from '../entities/episode.entity';
import { MediaAsset } from '../entities/media-asset.entity';
import { Genre } from '../../categories/entities/genre.entity';
import { Category } from '../../categories/entities/category.entity';
import { Language } from '../../languages/entities/language.entity';
import { Person } from '../../categories/entities/person.entity';
import { ContentCast } from '../../categories/entities/content-cast.entity';
import { TvodProduct } from '../../subscriptions/entities/tvod-product.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { ContentMapper } from './content.mapper';

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
    @InjectRepository(Series)
    private readonly seriesRepo: Repository<Series>,
    @InjectRepository(Season)
    private readonly seasonRepo: Repository<Season>,
    @InjectRepository(Episode)
    private readonly episodeRepo: Repository<Episode>,
    @InjectRepository(MediaAsset)
    private readonly mediaAssetRepo: Repository<MediaAsset>,
    @InjectRepository(Genre)
    private readonly genreRepo: Repository<Genre>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Language)
    private readonly languageRepo: Repository<Language>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(ContentCast)
    private readonly castRepo: Repository<ContentCast>,
    @InjectRepository(TvodProduct)
    private readonly tvodRepo: Repository<TvodProduct>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  private generateUniqueSlug(title: string): string {
    const base =
      String(title || 'content')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'content';
    return `${base}-${Date.now().toString(36).slice(-5)}`;
  }

  private async resolveRelations(body: any): Promise<{
    genres: Genre[];
    categories: Category[];
    languages: Language[];
    primaryLanguageCode: string;
  }> {
    let genres: Genre[] = [];
    const genreInputs = body?.genres || body?.genreIds || body?.genre_id;
    if (genreInputs) {
      const list = Array.isArray(genreInputs)
        ? genreInputs
        : String(genreInputs).split(',').map((s) => s.trim()).filter(Boolean);
      const ids = list
        .map((x) => (typeof x === 'object' ? x?.id : Number(x)))
        .filter((n) => typeof n === 'number' && !Number.isNaN(n) && n > 0);
      const names = list
        .map((x) => (typeof x === 'object' ? x?.name || x?.slug : String(x)))
        .filter((s) => typeof s === 'string' && Number.isNaN(Number(s)) && s.trim().length > 0);

      const conditions: any[] = [];
      if (ids.length > 0) conditions.push({ id: In(ids) });
      if (names.length > 0) {
        conditions.push({ name: In(names) });
        conditions.push({ slug: In(names.map((n) => n.toLowerCase().replace(/\s+/g, '-'))) });
      }
      if (conditions.length > 0) {
        genres = await this.genreRepo.find({ where: conditions });
      }
    }

    let categories: Category[] = [];
    const catInputs = body?.categories || body?.category || body?.categoryIds || body?.category_id;
    if (catInputs) {
      const list = Array.isArray(catInputs)
        ? catInputs
        : String(catInputs).split(',').map((s) => s.trim()).filter(Boolean);
      const ids = list
        .map((x) => (typeof x === 'object' ? x?.id : Number(x)))
        .filter((n) => typeof n === 'number' && !Number.isNaN(n) && n > 0);
      const names = list
        .map((x) => (typeof x === 'object' ? x?.name || x?.slug : String(x)))
        .filter((s) => typeof s === 'string' && Number.isNaN(Number(s)) && s.trim().length > 0);

      const conditions: any[] = [];
      if (ids.length > 0) conditions.push({ id: In(ids) });
      if (names.length > 0) {
        conditions.push({ name: In(names) });
        conditions.push({ slug: In(names.map((n) => n.toLowerCase().replace(/\s+/g, '-'))) });
      }
      if (conditions.length > 0) {
        categories = await this.categoryRepo.find({ where: conditions });
      }
    }

    let languages: Language[] = [];
    let primaryLanguageCode = 'kn';
    const langInputs =
      body?.languages ||
      body?.languageCodes ||
      body?.language_id ||
      body?.language ||
      body?.originalLanguage ||
      body?.original_language;

    if (langInputs) {
      const list = Array.isArray(langInputs)
        ? langInputs
        : String(langInputs).split(',').map((s) => s.trim()).filter(Boolean);
      const codes = list.map((x) => (typeof x === 'object' ? x?.code || x?.id : String(x).toLowerCase())).filter(Boolean);
      const names = list.map((x) => (typeof x === 'object' ? x?.name : String(x))).filter(Boolean);
      if (codes.length > 0 || names.length > 0) {
        languages = await this.languageRepo.find({
          where: [{ code: In(codes) }, { name: In(names) }],
        });
      }
    }

    const rawLang = String(body?.originalLanguage || body?.original_language || body?.language || '').trim();
    if (rawLang) {
      const matched = await this.languageRepo.findOne({
        where: [
          { code: rawLang.toLowerCase() },
          { name: ILike(rawLang) },
        ],
      });
      if (matched) {
        primaryLanguageCode = matched.code;
        if (!languages.some((l) => l.code === matched.code)) {
          languages.push(matched);
        }
      } else {
        primaryLanguageCode = rawLang.slice(0, 10).toLowerCase();
      }
    } else if (languages.length > 0) {
      primaryLanguageCode = languages[0].code;
    }

    return { genres, categories, languages, primaryLanguageCode };
  }

  private async syncCastAndTvod(contentId: number, body: any): Promise<void> {
    if (Array.isArray(body?.cast)) {
      await this.castRepo.delete({ contentId });
      for (let i = 0; i < body.cast.length; i++) {
        const c = body.cast[i];
        const actorName = typeof c === 'string' ? c.trim() : (c?.name || c?.fullName || '').trim();
        if (!actorName) continue;
        let personId = typeof c === 'object' ? (c.personId || c.id) : null;
        if (!personId) {
          let person = await this.personRepo.findOne({ where: { name: actorName } });
          if (!person) {
            person = await this.personRepo.save(
              this.personRepo.create({
                name: actorName,
                avatarUrl: typeof c === 'object' ? (c.avatarUrl || c.image || null) : null,
                knownForDepartment: typeof c === 'object' ? (c.roleType || 'ACTING') : 'ACTING',
              }),
            );
          }
          personId = person.id;
        }
        if (personId) {
          await this.castRepo.save(
            this.castRepo.create({
              contentId,
              personId: Number(personId),
              characterName: typeof c === 'object' ? (c.characterName || c.character_name || null) : null,
              roleType: typeof c === 'object' ? (c.roleType || c.role_type || 'ACTOR') : 'ACTOR',
              displayOrder: i + 1,
            }),
          );
        }
      }
    }

    const rentPrice = Number(body?.rentPrice ?? body?.rent_price ?? 0);
    const isTvod =
      body?.accessType === 'TVOD' ||
      body?.accessType === 'RENT' ||
      body?.monetization === 'TVOD' ||
      rentPrice > 0;

    if (isTvod) {
      let tvod = await this.tvodRepo.findOne({ where: { contentId } });
      const durationHours = Number(body?.rentalDurationHours ?? body?.validityHours ?? 48);
      const finalPrice = rentPrice > 0 ? rentPrice : 99;
      if (!tvod) {
        tvod = this.tvodRepo.create({
          contentId,
          price: finalPrice,
          currency: body?.currency || 'INR',
          purchaseType: String(body?.purchaseType || body?.purchase_type || 'RENTAL').toUpperCase(),
          rentalDurationHours: durationHours,
          validityHours: durationHours,
          isActive: true,
        });
      } else {
        tvod.price = finalPrice;
        tvod.rentalDurationHours = durationHours;
        tvod.validityHours = durationHours;
        if (body?.purchaseType || body?.purchase_type) {
          tvod.purchaseType = String(body.purchaseType || body.purchase_type).toUpperCase();
        }
        tvod.isActive = true;
      }
      await this.tvodRepo.save(tvod);
    }
  }

  // ==================== MOVIES CRUD ====================

  async listMovies(params: { page?: number; size?: number; search?: string; status?: string; contentType?: string }) {
    const page = Math.max(0, Number(params.page || 0));
    const size = Math.min(100, Math.max(1, Number(params.size || 20)));

    const qb = this.contentRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.movie', 'm')
      .leftJoinAndSelect('c.genres', 'g')
      .leftJoinAndSelect('c.languages', 'lang')
      .orderBy('c.createdAt', 'DESC')
      .skip(page * size)
      .take(size);

    if (params.contentType && params.contentType.trim() && params.contentType.toUpperCase() !== 'ALL') {
      const typeNorm = params.contentType.trim().toUpperCase();
      qb.andWhere('UPPER(c.contentTypeString) = :type', { type: typeNorm });
    }

    if (params.status) {
      qb.andWhere('c.status = :status', { status: params.status.toUpperCase() });
    }
    if (params.search && params.search.trim()) {
      qb.andWhere('c.title ILIKE :q', { q: `%${params.search.trim()}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      content: items.map((c) => ContentMapper.toDto(c)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
      page,
      size,
    };
  }

  async createOrUpdateMovie(body: any, id?: number): Promise<any> {
    const title = String(body?.title || body?.name || body?.video_title || '').trim();
    if (!id && !title) {
      throw new BadRequestException('Movie title is required');
    }

    const { genres, categories, languages, primaryLanguageCode } = await this.resolveRelations(body);

    const rawBannerUrl =
      body?.bannerUrl ||
      body?.bannerImageUrl ||
      body?.banner_url ||
      body?.backdropUrl ||
      body?.backdrop_url ||
      body?.landscape ||
      body?.landscapeImageUrl ||
      null;
    const rawPosterUrl = body?.posterUrl || body?.poster_url || body?.thumbnail || null;
    const posterUrl = rawPosterUrl ? ContentMapper.ensureAbsoluteMediaUrl(rawPosterUrl) : null;
    const bannerUrl = rawBannerUrl ? ContentMapper.ensureAbsoluteMediaUrl(rawBannerUrl) : null;
    const durationMinutes = Number(body?.durationMinutes ?? body?.duration ?? 120);
    const durationSeconds = durationMinutes * 60;
    const monetization = String(body?.monetization || (body?.isPremium ? 'SVOD' : 'AVOD')).toUpperCase();
    const accessType = String(body?.accessType || body?.access_type || monetization || 'PREMIUM').toUpperCase();
    const isPremium =
      body?.isPremium !== undefined && body?.isPremium !== null
        ? Boolean(body.isPremium)
        : monetization === 'SVOD' || accessType === 'PREMIUM' || accessType === 'TVOD';

    const rawRelDate = (body?.releaseDate && String(body.releaseDate).trim()) || (body?.release_date && String(body.release_date).trim()) || null;
    const cleanReleaseDate = rawRelDate ? rawRelDate.slice(0, 10) : null;

    let content = id
      ? await this.contentRepo.findOne({
          where: { id },
          relations: ['movie', 'genres', 'languages'],
        })
      : null;

    let resolvedProducerId: number | null = body?.producerId ? Number(body.producerId) : null;
    const prodName = body?.producer || body?.productionHouse;
    if (!resolvedProducerId && prodName) {
      try {
        const foundProd = await this.dataSource.query(
          'SELECT id FROM producer_profiles WHERE LOWER(company_name) = LOWER($1) LIMIT 1',
          [String(prodName).trim()],
        );
        if (foundProd && foundProd.length > 0) {
          resolvedProducerId = Number(foundProd[0].id);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!content) {
      content = this.contentRepo.create({
        title,
        slug: body?.slug || this.generateUniqueSlug(title),
        description: body?.description || null,
        shortDescription:
          body?.shortDescription ||
          body?.short_description ||
          (body?.description ? String(body.description).slice(0, 450) : null),
        type: 'MOVIE',
        contentTypeString: body?.contentType || 'MOVIE',
        status: (body?.status || 'PUBLISHED').toUpperCase(),
        accessType,
        monetization,
        isPremium,
        releaseYear:
          body?.releaseYear || body?.release_year
            ? Number(body.releaseYear || body.release_year)
            : cleanReleaseDate
              ? new Date(cleanReleaseDate).getFullYear()
              : new Date().getFullYear(),
        releaseDate: cleanReleaseDate,
        ageRating:
          body?.ageRating ||
          body?.maturityRating ||
          body?.maturity_rating ||
          body?.age_rating ||
          'U/A 13+',
        durationSeconds,
        imdbRating: body?.imdbRating !== undefined && body?.imdbRating !== null ? Number(body.imdbRating) : null,
        posterUrl,
        backdropUrl: bannerUrl,
        landscapeImageUrl: bannerUrl,
        bannerImageUrl: bannerUrl,
        trailerUrl: body?.trailerUrl || body?.trailer_url || null,
        originalLanguageCode: primaryLanguageCode,
        isFeatured: Boolean(body?.isFeatured ?? body?.is_featured ?? false),
        isTrending: Boolean(body?.isTrending ?? body?.is_trending ?? false),
        isOriginal: Boolean(body?.isOriginal ?? false),
        contentTypeId: body?.contentTypeId
          ? Number(body.contentTypeId)
          : String(body?.contentType || '').toUpperCase() === 'SHORT_FILM'
          ? 8
          : String(body?.contentType || '').toUpperCase() === 'DOCUMENTARY'
          ? 9
          : String(body?.contentType || '').toUpperCase() === 'MUSIC_VIDEO'
          ? 2
          : 3,
        producerId: resolvedProducerId,
        drmRuleId: body?.drmRuleId ? Number(body.drmRuleId) : null,
        genres: [],
        categories: [],
        languages: [],
      });
    } else {
      if (title) content.title = title;
      if (body.description !== undefined) content.description = body.description;
      if (body.shortDescription !== undefined) {
        content.shortDescription = body.shortDescription;
      } else if (body.description) {
        content.shortDescription = String(body.description).slice(0, 450);
      }
      if (body.status !== undefined) content.status = String(body.status).toUpperCase();
      content.accessType = accessType;
      content.monetization = monetization;
      content.isPremium = isPremium;
      if (body.releaseYear !== undefined) content.releaseYear = Number(body.releaseYear);
      if (body.releaseDate !== undefined) content.releaseDate = cleanReleaseDate;
      if (body.ageRating !== undefined || body.maturityRating !== undefined) {
        content.ageRating = body.ageRating || body.maturityRating || body.maturity_rating || content.ageRating;
      }
      content.durationSeconds = durationSeconds;
      if (body.imdbRating !== undefined) content.imdbRating = Number(body.imdbRating);
      if (posterUrl !== null) content.posterUrl = posterUrl;
      if (bannerUrl !== null) {
        content.backdropUrl = bannerUrl;
        content.landscapeImageUrl = bannerUrl;
        content.bannerImageUrl = bannerUrl;
      }
      if (body.trailerUrl !== undefined) content.trailerUrl = body.trailerUrl;
      if (primaryLanguageCode) content.originalLanguageCode = primaryLanguageCode;
      if (body.isFeatured !== undefined) content.isFeatured = Boolean(body.isFeatured);
      if (body.isTrending !== undefined) content.isTrending = Boolean(body.isTrending);
      if (body.isOriginal !== undefined) content.isOriginal = Boolean(body.isOriginal);
      if (body.drmRuleId !== undefined) content.drmRuleId = body.drmRuleId ? Number(body.drmRuleId) : null;
      if (resolvedProducerId !== null) content.producerId = resolvedProducerId;
    }

    content.genres = [];
    content.categories = [];
    content.languages = [];
    (content as any).castMembers = [];
    (content as any).tvodProducts = [];
    (content as any).movie = undefined;

    const savedContent = await this.contentRepo.save(content);

    // Safely sync Many-to-Many junction tables to avoid duplicate key or missing relation errors
    try {
      await this.dataSource.query('DELETE FROM content_genres WHERE content_id = $1', [savedContent.id]);
      if (genres.length > 0) {
        const uniqueGenreIds = [...new Set(genres.map((g) => Number(g.id)))].filter((n) => !Number.isNaN(n) && n > 0);
        for (const gid of uniqueGenreIds) {
          await this.dataSource.query(
            'INSERT INTO content_genres (content_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [savedContent.id, gid],
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed syncing content_genres: ${e.message}`);
    }

    try {
      await this.dataSource.query('DELETE FROM content_languages WHERE content_id = $1', [savedContent.id]);
      if (languages.length > 0) {
        const uniqueLangCodes = [...new Set(languages.map((l) => String(l.code).toLowerCase()))].filter(Boolean);
        for (const code of uniqueLangCodes) {
          await this.dataSource.query(
            'INSERT INTO content_languages (content_id, language_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [savedContent.id, code],
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed syncing content_languages: ${e.message}`);
    }

    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS content_categories (
          content_id BIGINT NOT NULL,
          category_id BIGINT NOT NULL,
          PRIMARY KEY (content_id, category_id)
        );
      `);
      await this.dataSource.query('DELETE FROM content_categories WHERE content_id = $1', [savedContent.id]);
      if (categories.length > 0) {
        const uniqueCatIds = [...new Set(categories.map((c) => Number(c.id)))].filter((n) => !Number.isNaN(n) && n > 0);
        for (const cid of uniqueCatIds) {
          await this.dataSource.query(
            'INSERT INTO content_categories (content_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [savedContent.id, cid],
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`content_categories sync skipped: ${e.message}`);
    }

    const videoUrl =
      body?.masterPlaylistUrl ||
      body?.videoUrl ||
      body?.video_url ||
      body?.video4kUrl ||
      body?.video2kUrl ||
      body?.video1080Url ||
      body?.video720Url ||
      body?.hlsUrl ||
      null;
    const bunnyVideoGuid =
      body?.bunnyVideoId || body?.bunnyVideoGuid || body?.bunny_video_id || null;
    const productionHouse =
      body?.productionHouse || body?.producer || null;

    try {
      await this.dataSource.query(
        `INSERT INTO movies (id, content_id, video_asset_id, stream_url, hls_url, duration_minutes, duration_seconds, production_house, director, writers, bunny_video_guid)
         VALUES ($1, $1, $2, $2, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           content_id = EXCLUDED.content_id,
           video_asset_id = EXCLUDED.video_asset_id,
           stream_url = EXCLUDED.stream_url,
           hls_url = EXCLUDED.hls_url,
           duration_minutes = EXCLUDED.duration_minutes,
           duration_seconds = EXCLUDED.duration_seconds,
           production_house = EXCLUDED.production_house,
           director = COALESCE(NULLIF(EXCLUDED.director, ''), movies.director),
           writers = COALESCE(NULLIF(EXCLUDED.writers, ''), movies.writers),
           bunny_video_guid = COALESCE(NULLIF(EXCLUDED.bunny_video_guid, ''), movies.bunny_video_guid)`,
        [
          savedContent.id,
          videoUrl || '',
          durationMinutes,
          durationSeconds,
          productionHouse || '',
          body?.director || '',
          body?.writers || '',
          bunnyVideoGuid || '',
        ],
      );
    } catch (e: any) {
      this.logger.warn(`Failed upserting movie record: ${e.message}`);
    }

    // Upsert MediaAsset for playback & inspector stream feeds
    try {
      const masterPlaylist = body?.masterPlaylistUrl || videoUrl;
      const hasResolutions = Boolean(
        body?.video320Url ||
          body?.video480Url ||
          body?.video720Url ||
          body?.video1080Url ||
          body?.video2kUrl ||
          body?.video4kUrl,
      );
      if (masterPlaylist || bunnyVideoGuid || hasResolutions) {
        let mediaAsset = await this.mediaAssetRepo.findOne({ where: { contentId: savedContent.id } });
        const resolutionsObj = {
          '320p': body?.video320Url || '',
          '480p': body?.video480Url || '',
          '720p': body?.video720Url || '',
          '1080p': body?.video1080Url || '',
          '2k': body?.video2kUrl || '',
          '4k': body?.video4kUrl || '',
        };
        const resolutionsStr = JSON.stringify(resolutionsObj);

        if (!mediaAsset) {
          mediaAsset = this.mediaAssetRepo.create({
            assetId: `asset_${savedContent.id}_${Date.now().toString(36)}`,
            contentId: savedContent.id,
            masterPlaylistUrl: masterPlaylist,
            manifestUrl: masterPlaylist,
            sourceUrl: body?.video4kUrl || body?.video1080Url || masterPlaylist,
            status: 'READY',
            transcodeStatus: 'COMPLETED',
            encryptionType: 'AES-128',
            resolutions: resolutionsStr,
            durationSeconds,
          });
        } else {
          if (masterPlaylist) {
            mediaAsset.masterPlaylistUrl = masterPlaylist;
            mediaAsset.manifestUrl = masterPlaylist;
          }
          if (body?.video4kUrl || body?.video1080Url) {
            mediaAsset.sourceUrl = body.video4kUrl || body.video1080Url;
          }
          mediaAsset.resolutions = resolutionsStr;
          mediaAsset.durationSeconds = durationSeconds;
          mediaAsset.status = 'READY';
          mediaAsset.transcodeStatus = 'COMPLETED';
        }
        await this.mediaAssetRepo.save(mediaAsset);
      }
    } catch (e: any) {
      this.logger.warn(`Failed upserting media_asset: ${e.message}`);
    }

    try {
      await this.syncCastAndTvod(savedContent.id, body);
    } catch (e: any) {
      this.logger.warn(`Failed syncing cast/tvod: ${e.message}`);
    }

    await this.redisService.delByPrefix('catalog:');
    await this.redisService.delByPrefix('cms:');
    await this.redisService.delByPrefix('analytics:');

    const full = await this.contentRepo.findOne({
      where: { id: savedContent.id },
      relations: [
        'movie',
        'genres',
        'languages',
      ],
    });

    if (full) {
      full.categories = categories;
      try {
        full.castMembers = await this.castRepo.find({
          where: { contentId: savedContent.id },
          relations: ['person'],
        });
      } catch {}
      try {
        full.tvodProducts = await this.tvodRepo.find({
          where: { contentId: savedContent.id },
        });
      } catch {}
    }

    return ContentMapper.toDto(full!);
  }

  async updateContentStatus(id: number, status: string): Promise<any> {
    const content = await this.contentRepo.findOne({
      where: { id },
      relations: ['movie', 'genres', 'languages'],
    });
    if (!content) {
      throw new NotFoundException(`Content with ID ${id} not found`);
    }

    const normalized = String(status || '').toUpperCase().trim();
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SUBMITTED'].includes(normalized)) {
      throw new BadRequestException(`Invalid status: '${status}'. Supported statuses: DRAFT, PUBLISHED, ARCHIVED.`);
    }

    content.status = normalized;
    const saved = await this.contentRepo.save(content);

    // Invalidate public and admin caches immediately
    await this.redisService.delByPrefix('catalog:');
    await this.redisService.delByPrefix('cms:');
    await this.redisService.delByPrefix('analytics:');

    return ContentMapper.toDto(saved);
  }

  async deleteContent(id: number): Promise<any> {
    const content = await this.contentRepo.findOne({ where: { id } });
    if (!content) throw new NotFoundException(`Content ${id} not found`);

    await this.dataSource.transaction(async (manager) => {
      // Safely delete all dependent and referencing records before deleting content
      await manager.query('DELETE FROM banners WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM section_items WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM watch_history WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM watchlist WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM playback_sessions WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM content_purchases WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM content_cast WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM content_genres WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM content_categories WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM content_languages WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM media_assets WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM tvod_products WHERE content_id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM movies WHERE id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM series WHERE id = $1', [id]).catch(() => {});
      await manager.query('DELETE FROM contents WHERE id = $1', [id]);
    });

    await this.redisService.delByPrefix('catalog:');
    await this.redisService.delByPrefix('cms:');
    return { id, deleted: true };
  }

  // ==================== SERIES, SEASONS & EPISODES CRUD ====================

  async listSeries(params: { page?: number; size?: number; search?: string; status?: string }) {
    const page = Math.max(0, Number(params.page || 0));
    const size = Math.min(100, Math.max(1, Number(params.size || 20)));

    const qb = this.contentRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.series', 's')
      .leftJoinAndSelect('s.seasons', 'season')
      .leftJoinAndSelect('season.episodes', 'ep')
      .leftJoinAndSelect('c.genres', 'g')
      .leftJoinAndSelect('c.categories', 'cat')
      .leftJoinAndSelect('c.languages', 'lang')
      .where('c.type = :type', { type: 'SERIES' })
      .orderBy('c.createdAt', 'DESC')
      .skip(page * size)
      .take(size);

    if (params.status) {
      qb.andWhere('c.status = :status', { status: params.status.toUpperCase() });
    }
    if (params.search && params.search.trim()) {
      qb.andWhere('c.title ILIKE :q', { q: `%${params.search.trim()}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      content: items.map((c) => ContentMapper.toDto(c)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
      page,
      size,
    };
  }

  async createOrUpdateSeries(body: any, id?: number): Promise<any> {
    const title = String(body?.title || body?.name || '').trim();
    if (!id && !title) {
      throw new BadRequestException('Series title is required');
    }

    const { genres, categories, languages } = await this.resolveRelations(body);

    let content = id
      ? await this.contentRepo.findOne({
          where: { id },
          relations: ['series', 'genres', 'languages'],
        })
      : null;

    if (!content) {
      content = this.contentRepo.create({
        title,
        slug: body?.slug || this.generateUniqueSlug(title),
        description: body?.description || null,
        shortDescription: body?.shortDescription || null,
        type: 'SERIES',
        status: (body?.status || 'PUBLISHED').toUpperCase(),
        accessType: (body?.accessType || 'PREMIUM').toUpperCase(),
        releaseYear: body?.releaseYear ? Number(body.releaseYear) : new Date().getFullYear(),
        releaseDate: body?.releaseDate || null,
        ageRating: body?.ageRating || 'U/A 16+',
        imdbRating: body?.imdbRating !== undefined ? Number(body.imdbRating) : null,
        posterUrl: body?.posterUrl || body?.thumbnail ? ContentMapper.ensureAbsoluteMediaUrl(body?.posterUrl || body?.thumbnail) : null,
        backdropUrl: body?.backdropUrl || body?.landscape ? ContentMapper.ensureAbsoluteMediaUrl(body?.backdropUrl || body?.landscape) : null,
        trailerUrl: body?.trailerUrl || null,
        isFeatured: Boolean(body?.isFeatured ?? false),
        isTrending: Boolean(body?.isTrending ?? false),
        isOriginal: Boolean(body?.isOriginal ?? false),
        genres,
        categories,
        languages,
      });
    } else {
      if (title) content.title = title;
      if (body.description !== undefined) content.description = body.description;
      if (body.status !== undefined) content.status = String(body.status).toUpperCase();
      if (body.accessType !== undefined) content.accessType = String(body.accessType).toUpperCase();
      if (body.releaseYear !== undefined) content.releaseYear = Number(body.releaseYear);
      if (body.ageRating !== undefined) content.ageRating = body.ageRating;
      if (body.imdbRating !== undefined) content.imdbRating = Number(body.imdbRating);
      if (body.posterUrl !== undefined) content.posterUrl = ContentMapper.ensureAbsoluteMediaUrl(body.posterUrl);
      if (body.backdropUrl !== undefined) content.backdropUrl = ContentMapper.ensureAbsoluteMediaUrl(body.backdropUrl);
      if (body.trailerUrl !== undefined) content.trailerUrl = body.trailerUrl;
      if (body.isFeatured !== undefined) content.isFeatured = Boolean(body.isFeatured);
      if (body.isTrending !== undefined) content.isTrending = Boolean(body.isTrending);
      if (genres.length > 0 || Array.isArray(body.genres)) content.genres = genres;
      if (categories.length > 0 || Array.isArray(body.categories)) content.categories = categories;
      if (languages.length > 0 || Array.isArray(body.languages)) content.languages = languages;
    }

    const savedContent = await this.contentRepo.save(content);

    let series = await this.seriesRepo.findOne({ where: { id: savedContent.id } });
    if (!series) {
      series = this.seriesRepo.create({
        id: savedContent.id,
        totalSeasons: Number(body?.totalSeasons ?? 1),
        totalEpisodes: Number(body?.totalEpisodes ?? 0),
        isOngoing: Boolean(body?.isOngoing ?? true),
      });
    } else {
      if (body.totalSeasons !== undefined) series.totalSeasons = Number(body.totalSeasons);
      if (body.totalEpisodes !== undefined) series.totalEpisodes = Number(body.totalEpisodes);
      if (body.isOngoing !== undefined) series.isOngoing = Boolean(body.isOngoing);
    }
    await this.seriesRepo.save(series);

    await this.syncCastAndTvod(savedContent.id, body);
    await this.redisService.delByPrefix('catalog:');
    await this.redisService.delByPrefix('cms:');

    const full = await this.contentRepo.findOne({
      where: { id: savedContent.id },
      relations: ['series', 'series.seasons', 'series.seasons.episodes', 'genres', 'languages'],
    });

    if (full) {
      full.categories = categories;
      try {
        full.castMembers = await this.castRepo.find({
          where: { contentId: savedContent.id },
          relations: ['person'],
        });
      } catch {}
    }

    return ContentMapper.toDto(full!);
  }

  async createOrUpdateSeason(seriesId: number, body: any, seasonId?: number): Promise<any> {
    let season = seasonId ? await this.seasonRepo.findOne({ where: { id: seasonId } }) : null;
    const seasonNumber = Number(body?.seasonNumber ?? body?.season_number ?? 1);

    if (!season) {
      season = this.seasonRepo.create({
        seriesId,
        seasonNumber,
        title: body?.title || `Season ${seasonNumber}`,
        description: body?.description || null,
        posterUrl: body?.posterUrl || null,
        releaseYear: body?.releaseYear ? Number(body.releaseYear) : new Date().getFullYear(),
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      if (body.seasonNumber !== undefined) season.seasonNumber = Number(body.seasonNumber);
      if (body.title !== undefined) season.title = body.title;
      if (body.description !== undefined) season.description = body.description;
      if (body.posterUrl !== undefined) season.posterUrl = body.posterUrl;
      if (body.isActive !== undefined) season.isActive = Boolean(body.isActive);
    }

    const saved = await this.seasonRepo.save(season);
    await this.redisService.delByPrefix('catalog:');
    return ContentMapper.toSeasonDto(saved);
  }

  async deleteSeason(seasonId: number): Promise<any> {
    const season = await this.seasonRepo.findOne({ where: { id: seasonId } });
    if (!season) throw new NotFoundException(`Season ${seasonId} not found`);
    await this.episodeRepo.delete({ seasonId });
    await this.seasonRepo.remove(season);
    await this.redisService.delByPrefix('catalog:');
    return { id: seasonId, deleted: true };
  }

  async createOrUpdateEpisode(seasonId: number, body: any, episodeId?: number): Promise<any> {
    let episode = episodeId ? await this.episodeRepo.findOne({ where: { id: episodeId } }) : null;
    const episodeNumber = Number(body?.episodeNumber ?? body?.episode_number ?? 1);
    const durationMinutes = Number(body?.durationMinutes ?? body?.duration ?? 30);

    if (!episode) {
      episode = this.episodeRepo.create({
        seasonId,
        episodeNumber,
        title: body?.title || `Episode ${episodeNumber}`,
        description: body?.description || null,
        durationMinutes,
        durationSeconds: Number(body?.durationSeconds ?? durationMinutes * 60),
        thumbnailUrl: body?.thumbnailUrl || body?.thumbnail || null,
        videoUrl: body?.videoUrl || body?.video_url || null,
        bunnyVideoGuid: body?.bunnyVideoGuid || null,
        accessType: (body?.accessType || 'PREMIUM').toUpperCase(),
        isFreePreview: Boolean(body?.isFreePreview ?? episodeNumber === 1),
        status: (body?.status || 'PUBLISHED').toUpperCase(),
        releaseDate: body?.releaseDate || null,
      });
    } else {
      if (body.episodeNumber !== undefined) episode.episodeNumber = Number(body.episodeNumber);
      if (body.title !== undefined) episode.title = body.title;
      if (body.description !== undefined) episode.description = body.description;
      if (body.durationMinutes !== undefined) {
        episode.durationMinutes = Number(body.durationMinutes);
        episode.durationSeconds = Number(body.durationMinutes) * 60;
      }
      if (body.thumbnailUrl !== undefined) episode.thumbnailUrl = body.thumbnailUrl;
      if (body.videoUrl !== undefined || body.video_url !== undefined) {
        episode.videoUrl = body.videoUrl ?? body.video_url;
      }
      if (body.bunnyVideoGuid !== undefined) episode.bunnyVideoGuid = body.bunnyVideoGuid;
      if (body.accessType !== undefined) episode.accessType = String(body.accessType).toUpperCase();
      if (body.isFreePreview !== undefined) episode.isFreePreview = Boolean(body.isFreePreview);
      if (body.status !== undefined) episode.status = String(body.status).toUpperCase();
    }

    const saved = await this.episodeRepo.save(episode);
    await this.redisService.delByPrefix('catalog:');
    return ContentMapper.toEpisodeDto(saved);
  }

  async deleteEpisode(episodeId: number): Promise<any> {
    const ep = await this.episodeRepo.findOne({ where: { id: episodeId } });
    if (!ep) throw new NotFoundException(`Episode ${episodeId} not found`);
    await this.episodeRepo.remove(ep);
    await this.redisService.delByPrefix('catalog:');
    return { id: episodeId, deleted: true };
  }
}

