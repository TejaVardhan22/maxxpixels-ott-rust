import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Content } from '../entities/content.entity';
import { Season } from '../entities/season.entity';
import { Episode } from '../entities/episode.entity';
import { Language } from '../../languages/entities/language.entity';
import { Category } from '../../categories/entities/category.entity';
import { Genre } from '../../categories/entities/genre.entity';
import { ContentType } from '../../categories/entities/content-type.entity';
import { ContentPurchase } from '../../subscriptions/entities/content-purchase.entity';
import { Watchlist } from '../../watch-history/entities/watchlist.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { PageResponse } from '../../../common/dto/page-response.dto';
import { ContentMapper } from './content.mapper';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(Season)
    private readonly seasonRepo: Repository<Season>,
    @InjectRepository(Episode)
    private readonly episodeRepo: Repository<Episode>,
    @InjectRepository(Language)
    private readonly languageRepo: Repository<Language>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Genre)
    private readonly genreRepo: Repository<Genre>,
    @InjectRepository(ContentType)
    private readonly contentTypeRepo: Repository<ContentType>,
    @InjectRepository(ContentPurchase)
    private readonly purchaseRepo: Repository<ContentPurchase>,
    @InjectRepository(Watchlist)
    private readonly watchlistRepo: Repository<Watchlist>,
    private readonly redisService: RedisService,
  ) {}

  private createCatalogQueryBuilder(includeDrafts = false): SelectQueryBuilder<Content> {
    const qb = this.contentRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.movie', 'm')
      .leftJoinAndSelect('c.genres', 'g')
      .leftJoinAndSelect('c.categories', 'cat')
      .leftJoinAndSelect('c.languages', 'lang');

    if (!includeDrafts) {
      qb.where('c.status = :status', { status: 'PUBLISHED' });
    }
    return qb;
  }

  private getLanguageVariants(lang: string): string[] {
    const l = (lang || '').toLowerCase().trim();
    if (l === 'kn' || l === 'kannada' || l === 'kan') {
      return ['kn', 'kannada', 'kan'];
    }
    if (l === 'hi' || l === 'hindi' || l === 'hin') {
      return ['hi', 'hindi', 'hin'];
    }
    if (l === 'ta' || l === 'tamil' || l === 'tam') {
      return ['ta', 'tamil', 'tam'];
    }
    if (l === 'te' || l === 'telugu' || l === 'tel') {
      return ['te', 'telugu', 'tel'];
    }
    if (l === 'ml' || l === 'malayalam' || l === 'mal') {
      return ['ml', 'malayalam', 'mal'];
    }
    if (l === 'en' || l === 'english' || l === 'eng') {
      return ['en', 'english', 'eng'];
    }
    return [l];
  }

  private normalizeContentType(type?: string): string | null {
    if (!type) return null;
    const t = String(type).toUpperCase().trim();
    if (t === 'MOVIES' || t === 'MOVIE' || t === 'FILM' || t === 'FILMS' || t === '1') return 'MOVIE';
    if (t === 'SONGS' || t === 'SONG' || t === 'ALBUM' || t === 'ALBUMS' || t === 'MUSIC' || t === '2') return 'ALBUM';
    if (t === 'SHORTS' || t === 'SHORT' || t === 'SHORT_FILM' || t === 'SHORT-FILM' || t === 'SHORT_FILMS' || t === '3') return 'SHORT_FILM';
    if (t === 'MICRODRAMA' || t === 'MICRO-DRAMA' || t === 'MICRO_DRAMA' || t === 'MICRODRAMAS' || t === '4') return 'MICRODRAMA';
    if (t === 'PODCAST' || t === 'PODCASTS' || t === '5') return 'PODCAST';
    if (t === 'SERIES' || t === 'SHOWS' || t === 'WEB-SERIES' || t === '6') return 'SERIES';
    if (t === 'ALL') return null;
    return t;
  }

  async browseCatalog(params: {
    page?: number;
    size?: number;
    type?: string;
    categoryId?: number;
    genreId?: number;
    language?: string;
    accessType?: string;
    featured?: boolean;
    trending?: boolean;
    search?: string;
    includeDrafts?: boolean;
  }): Promise<PageResponse<any>> {
    const page = Math.max(0, Number(params.page || 0));
    const size = Math.min(100, Math.max(1, Number(params.size || 20)));
    const cacheKey = `catalog:browse:${JSON.stringify({ ...params, page, size })}`;

    return this.redisService.getOrSet(cacheKey, 120, async () => {
      const qb = this.createCatalogQueryBuilder(Boolean(params.includeDrafts));

      if (params.type) {
        const normType = this.normalizeContentType(params.type);
        if (normType) {
          qb.andWhere('c.contentTypeString = :type', { type: normType });
        }
      }
      if (params.accessType) {
        if (params.accessType.toUpperCase() === 'FREE') {
          qb.andWhere('c.isPremium = false');
        } else {
          qb.andWhere('c.isPremium = true');
        }
      }
      if (params.featured !== undefined || params.trending !== undefined) {
        qb.andWhere('c.isFeatured = true');
      }
      if (params.categoryId) {
        qb.andWhere('(g.id = :catId OR c.contentTypeId = :catId)', { catId: Number(params.categoryId) });
      }
      if (params.genreId) {
        qb.andWhere('g.id = :genreId', { genreId: Number(params.genreId) });
      }
      if (params.language && params.language !== 'all') {
        const langVariants = this.getLanguageVariants(params.language);
        qb.andWhere(
          '(LOWER(c.originalLanguageCode) IN (:...langVariants) OR LOWER(lang.code) IN (:...langVariants) OR LOWER(lang.name) IN (:...langVariants))',
          { langVariants },
        );
      }
      if (params.search && params.search.trim()) {
        const q = `%${params.search.trim()}%`;
        qb.andWhere(
          '(c.title ILIKE :q OR c.description ILIKE :q OR g.name ILIKE :q)',
          { q },
        );
      }

      qb.orderBy('c.isFeatured', 'DESC')
        .addOrderBy('c.createdAt', 'DESC')
        .skip(page * size)
        .take(size);

      const [items, total] = await qb.getManyAndCount();
      const dtos = items.map((c) => ContentMapper.toDto(c));
      return PageResponse.of(dtos, total, page, size);
    });
  }

  async getContentDetail(idOrSlug: string | number, userId?: string, includeDrafts = false): Promise<any> {
    const isNumeric = !Number.isNaN(Number(idOrSlug)) && String(idOrSlug).trim() !== '';
    const qb = this.createCatalogQueryBuilder(includeDrafts);

    if (isNumeric) {
      qb.andWhere('c.id = :id', { id: Number(idOrSlug) });
    } else {
      qb.andWhere('c.slug = :slug', { slug: String(idOrSlug) });
    }

    const content = await qb.getOne();
    if (!content) {
      throw new NotFoundException(`Content '${idOrSlug}' not found`);
    }

    if (content.producerId && (!content.movie?.productionHouse || content.movie.productionHouse.trim() === '')) {
      try {
        const pRows = await this.contentRepo.query(
          'SELECT company_name FROM producer_profiles WHERE id = $1',
          [content.producerId],
        );
        if (pRows && pRows.length > 0 && pRows[0].company_name) {
          if (content.movie) {
            content.movie.productionHouse = pRows[0].company_name;
          }
          (content as any).productionHouse = pRows[0].company_name;
          (content as any).producer = { companyName: pRows[0].company_name };
        }
      } catch (e) {}
    }

    if (!content.categories || content.categories.length === 0) {
      try {
        const catRows = await this.contentRepo.query(
          'SELECT c.id, c.name, c.slug FROM content_categories cc JOIN categories c ON c.id = cc.category_id WHERE cc.content_id = $1',
          [content.id],
        );
        if (catRows && catRows.length > 0) {
          content.categories = catRows;
        } else {
          const defaultCatName = content.isTrending ? 'Trending Now' : (content.isFeatured ? 'Blockbuster Movies' : 'New Releases');
          const found = await this.contentRepo.query('SELECT id, name, slug FROM categories WHERE name = $1 LIMIT 1', [defaultCatName]);
          if (found && found.length > 0) {
            content.categories = found;
            await this.contentRepo.query('INSERT INTO content_categories (content_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [content.id, found[0].id]).catch(() => {});
          }
        }
      } catch (e) {}
    }

    if (!content.castMembers || content.castMembers.length === 0) {
      try {
        const castRows = await this.contentRepo.query(
          `SELECT cc.id, cc.character_name, cc.role_type, cc.display_order, p.id as person_id, p.name, p.avatar_url, p.profile_image 
           FROM content_cast cc 
           JOIN people p ON p.id = cc.person_id 
           WHERE cc.content_id = $1 
           ORDER BY cc.display_order ASC`,
          [content.id],
        );
        if (castRows && castRows.length > 0) {
          content.castMembers = castRows.map((r: any) => ({
            id: r.id,
            personId: r.person_id,
            characterName: r.character_name,
            roleType: r.role_type,
            displayOrder: r.display_order,
            person: {
              id: r.person_id,
              name: r.name,
              avatarUrl: r.avatar_url || r.profile_image || null,
            },
          }));
        }
      } catch (e) {}
    }

    let isRented = false;
    let isWatchlisted = false;

    if (userId) {
      const purchase = await this.purchaseRepo.findOne({
        where: { userId, contentId: content.id },
      });
      if (purchase && (!purchase.validUntil || purchase.validUntil > new Date())) {
        isRented = true;
      }

      const wl = await this.watchlistRepo.findOne({
        where: { userId, contentId: content.id },
      });
      isWatchlisted = Boolean(wl);
    }

    // Fetch related content in same genre/type without N+1
    const relatedQb = this.createCatalogQueryBuilder(false)
      .andWhere('c.id != :id', { id: content.id })
      .andWhere('c.contentTypeString = :type', { type: content.contentTypeString || 'MOVIE' })
      .orderBy('c.viewCount', 'DESC')
      .take(10);

    const related = await relatedQb.getMany();
    const dto = ContentMapper.toDto(content, { isRented, isWatchlisted });

    return {
      ...dto,
      relatedContent: related.map((r) => ContentMapper.toDto(r)),
    };
  }

  async getContentByCategorySlugOrId(
    categorySlugOrId: string | number,
    page = 0,
    size = 50,
    language?: string,
  ): Promise<any[]> {
    const raw = String(categorySlugOrId ?? '').trim();
    const isNum = !Number.isNaN(Number(raw)) && /^\d+$/.test(raw);
    const qb = this.createCatalogQueryBuilder(false);

    if (isNum) {
      const numId = Number(raw);
      if (numId === 1) {
        qb.andWhere('(c.contentTypeString = :type OR c.contentTypeId = 1 OR g.id = 1)', { type: 'MOVIE' });
      } else if (numId === 2) {
        qb.andWhere('(c.contentTypeString = :type OR c.contentTypeId = 2 OR g.id = 2)', { type: 'ALBUM' });
      } else if (numId === 3) {
        qb.andWhere('(c.contentTypeString = :type OR c.contentTypeId = 3 OR g.id = 3)', { type: 'SHORT_FILM' });
      } else if (numId === 4) {
        qb.andWhere('(c.contentTypeString = :type OR c.contentTypeId = 4 OR g.id = 4)', { type: 'MICRODRAMA' });
      } else if (numId === 5) {
        qb.andWhere('(c.contentTypeString = :type OR c.contentTypeId = 5 OR g.id = 5)', { type: 'PODCAST' });
      } else if (numId === 6) {
        qb.andWhere('(c.contentTypeString = :type OR c.contentTypeId = 6 OR g.id = 6)', { type: 'SERIES' });
      } else {
        qb.andWhere('(g.id = :numId OR c.contentTypeId = :numId)', { numId });
      }
    } else {
      const slug = raw.toLowerCase();
      if (slug === 'movies' || slug === 'movie' || slug === 'films' || slug === 'film') {
        qb.andWhere('(c.contentTypeString = :type OR LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { type: 'MOVIE', slug });
      } else if (slug === 'songs' || slug === 'song' || slug === 'albums' || slug === 'album' || slug === 'music') {
        qb.andWhere('(c.contentTypeString = :type OR LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { type: 'ALBUM', slug });
      } else if (slug === 'shorts' || slug === 'short' || slug === 'short-film' || slug === 'short-films' || slug === 'short_film') {
        qb.andWhere('(c.contentTypeString = :type OR LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { type: 'SHORT_FILM', slug });
      } else if (slug === 'microdrama' || slug === 'micro-drama' || slug === 'microdramas') {
        qb.andWhere('(c.contentTypeString = :type OR LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { type: 'MICRODRAMA', slug });
      } else if (slug === 'podcasts' || slug === 'podcast') {
        qb.andWhere('(c.contentTypeString = :type OR LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { type: 'PODCAST', slug });
      } else if (slug === 'shows' || slug === 'series' || slug === 'web-series') {
        qb.andWhere('(c.contentTypeString = :type OR LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { type: 'SERIES', slug });
      } else {
        qb.andWhere('(LOWER(g.slug) = :slug OR LOWER(g.name) = :slug)', { slug });
      }
    }

    if (language && language !== 'all') {
      const langVariants = this.getLanguageVariants(language);
      qb.andWhere(
        '(LOWER(c.originalLanguageCode) IN (:...langVariants) OR LOWER(lang.code) IN (:...langVariants) OR LOWER(lang.name) IN (:...langVariants))',
        { langVariants },
      );
    }

    const p = Math.max(0, Number(page || 0));
    const s = Math.min(100, Math.max(1, Number(size || 50)));
    const items = await qb.orderBy('c.createdAt', 'DESC').skip(p * s).take(s).getMany();
    return items.map((c) => ContentMapper.toDto(c));
  }

  async getNonKannadaContent(page = 0, size = 50): Promise<any[]> {
    const p = Math.max(0, Number(page || 0));
    const s = Math.min(100, Math.max(1, Number(size || 50)));
    const items = await this.createCatalogQueryBuilder(false)
      .andWhere(
        '(c.originalLanguageCode IS NOT NULL AND LOWER(c.originalLanguageCode) NOT IN (:...kannadaVariants))',
        { kannadaVariants: ['kn', 'kan', 'kannada'] },
      )
      .orderBy('c.createdAt', 'DESC')
      .skip(p * s)
      .take(s)
      .getMany();
    return items.map((c) => ContentMapper.toDto(c));
  }

  async purchaseTvodContent(
    userId: string,
    bodyOrContentId: any,
    price = 99,
    validityHours = 48,
    transactionId?: string,
  ): Promise<any> {
    const isObj = bodyOrContentId && typeof bodyOrContentId === 'object';
    const contentId = isObj
      ? Number(bodyOrContentId.contentId ?? bodyOrContentId.id ?? 0)
      : Number(bodyOrContentId);
    const effectivePrice = isObj ? Number(bodyOrContentId.price ?? price) : Number(price || 99);
    const effectiveHours = isObj
      ? Number(bodyOrContentId.validityHours ?? bodyOrContentId.validity_hours ?? validityHours)
      : Number(validityHours || 48);
    const effectiveTxId = isObj
      ? String(bodyOrContentId.transactionId ?? bodyOrContentId.transaction_id ?? `TVOD-${Date.now()}`)
      : transactionId || `TVOD-${Date.now()}`;

    const expiresAt = new Date(Date.now() + effectiveHours * 3600 * 1000);
    const purchase = this.purchaseRepo.create({
      userId,
      contentId,
      price: effectivePrice,
      amountPaid: effectivePrice,
      currency: 'INR',
      purchaseType: 'RENT',
      paymentId: effectiveTxId,
      status: 'ACTIVE',
      purchasedAt: new Date(),
      expiresAt,
      validUntil: expiresAt,
    });
    const saved = await this.purchaseRepo.save(purchase);
    return {
      id: saved.id,
      contentId: saved.contentId,
      status: saved.status,
      expiresAt: saved.expiresAt,
      isRented: true,
    };
  }

  async getSeasonsBySeries(seriesId: number): Promise<any[]> {
    const seasons = await this.seasonRepo.find({
      where: { seriesId },
      relations: ['episodes'],
      order: { seasonNumber: 'ASC' },
    });
    return seasons.map((s) => ContentMapper.toSeasonDto(s));
  }

  async getEpisodesBySeason(seasonId: number): Promise<any[]> {
    const episodes = await this.episodeRepo.find({
      where: { seasonId },
      order: { episodeNumber: 'ASC' },
    });
    return episodes.map((e) => ContentMapper.toEpisodeDto(e));
  }

  async getRentedContentList(userId?: string): Promise<any[]> {
    if (userId) {
      const purchases = await this.purchaseRepo.find({
        where: { userId, status: 'ACTIVE' },
        relations: ['content', 'content.movie', 'content.series', 'content.tvodProducts'],
        order: { purchasedAt: 'DESC' },
      });
      const valid = purchases.filter((p) => p.content && (!p.expiresAt || p.expiresAt > new Date()));
      if (valid.length > 0) {
        return valid.map((p) => ContentMapper.toDto(p.content, { isRented: true }));
      }
    }

    // Also return catalog items available for TVOD rental
    const tvodContents = await this.createCatalogQueryBuilder(false)
      .andWhere('c.accessType IN (:...types)', { types: ['TVOD', 'RENT'] })
      .orderBy('c.createdAt', 'DESC')
      .take(30)
      .getMany();

    return tvodContents.map((c) => ContentMapper.toDto(c));
  }

  async getPublicMetadata(): Promise<any> {
    return this.redisService.getOrSet('catalog:public_metadata', 300, async () => {
      const [rawLanguages, categories, rawGenres, rawContentTypes] = await Promise.all([
        this.languageRepo.find({ order: { id: 'ASC' } }),
        this.categoryRepo.find({ order: { displayOrder: 'ASC' } }).catch(() => []),
        this.genreRepo.find({ order: { id: 'ASC' } }),
        this.contentTypeRepo.find({ order: { id: 'ASC' } }),
      ]);

      const languages = rawLanguages.map((l) => ({
        id: Number(l.id),
        code: l.code,
        name: l.name,
        nativeName: l.name,
        displayOrder: Number(l.id),
        isActive: true,
      }));

      const genres = rawGenres.map((g) => ({
        id: Number(g.id),
        name: g.name,
        slug: g.slug,
        isActive: true,
      }));

      const contentTypes = rawContentTypes.map((ct) => ({
        id: Number(ct.id),
        title: ct.title,
        name: ct.title,
        slug: ct.slug,
        displayOrder: Number(ct.id),
        isActive: true,
      }));

      return {
        languages,
        categories: categories.length > 0 ? categories : genres,
        genres,
        contentTypes,
      };
    });
  }
}

