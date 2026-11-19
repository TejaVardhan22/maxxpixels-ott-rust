import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Page } from '../entities/page.entity';
import { Section } from '../entities/section.entity';
import { SectionItem } from '../entities/section-item.entity';
import { Banner } from '../entities/banner.entity';
import { Content } from '../entities/content.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { ContentMapper } from './content.mapper';

@Injectable()
export class CmsService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(SectionItem)
    private readonly sectionItemRepo: Repository<SectionItem>,
    @InjectRepository(Banner)
    private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  // ==================== PUBLIC CMS ENDPOINTS ====================

  private resolveEffectiveTypeId(typeId?: number, type?: string, pageSlug = 'home'): number {
    if (typeId && Number(typeId) > 0) return Number(typeId);
    if (type) {
      const t = String(type).toUpperCase().trim();
      if (t === 'MOVIE' || t === 'MOVIES' || t === 'FILM' || t === '1') return 1;
      if (t === 'ALBUM' || t === 'SONG' || t === 'SONGS' || t === 'MUSIC' || t === '2') return 2;
      if (t === 'SHORT_FILM' || t === 'SHORTS' || t === 'SHORT' || t === '3') return 3;
      if (t === 'MICRODRAMA' || t === 'MICRO-DRAMA' || t === '4') return 4;
      if (t === 'PODCAST' || t === 'PODCASTS' || t === '5') return 5;
      if (t === 'SERIES' || t === 'SHOWS' || t === '6') return 6;
      if (t.startsWith('AI_') || t === '7') return 7;
    }
    const slug = (pageSlug || '').toLowerCase().trim();
    if (slug === 'movies' || slug === 'movie' || slug === 'films') return 1;
    if (slug === 'songs' || slug === 'music' || slug === 'albums') return 2;
    if (slug === 'shorts') return 3;
    if (slug === 'microdrama' || slug === 'microdramas') return 4;
    if (slug === 'podcasts' || slug === 'podcast') return 5;
    if (slug === 'shows' || slug === 'series') return 6;
    return 0;
  }

  async getBanners(pageSlug = 'home', language?: string, typeId?: number, type?: string): Promise<any[]> {
    const effTypeId = this.resolveEffectiveTypeId(typeId, type, pageSlug);
    const cacheKey = `cms:banners:${pageSlug}:${language || 'all'}:${effTypeId}`;
    return this.redisService.getOrSet(cacheKey, 120, async () => {
      let banners: Banner[] = [];
      try {
        banners = await this.bannerRepo.find({
          where: { isActive: true },
          relations: ['content', 'content.movie', 'content.genres', 'content.languages'],
          order: { displayOrder: 'ASC', id: 'DESC' },
        });
      } catch {
        banners = [];
      }

      if (banners.length > 0) {
        banners = banners.filter((b) => !b.content || !b.content.status || b.content.status === 'PUBLISHED');
        let mappedBanners = banners.map((b) => ContentMapper.toBannerDto(b)).filter(Boolean);
        if (language && language !== 'all') {
          const lLower = language.toLowerCase().trim();
          const lVariants = ['kn', 'kannada', 'kan'].includes(lLower)
            ? ['kn', 'kannada', 'kan']
            : ['hi', 'hindi', 'hin'].includes(lLower)
            ? ['hi', 'hindi', 'hin']
            : ['ta', 'tamil', 'tam'].includes(lLower)
            ? ['ta', 'tamil', 'tam']
            : [lLower];
          mappedBanners = mappedBanners.filter((b: any) =>
            lVariants.includes(String(b?.originalLanguageCode || b?.original_language_code || '').toLowerCase().trim()),
          );
        }
        if (effTypeId > 0) {
          mappedBanners = mappedBanners.filter((b: any) => b.typeId === effTypeId || b.videoType === effTypeId);
        }
        if (mappedBanners.length > 0) return mappedBanners;
      }

      // Fallback: synthesize hero banners from featured published content (or latest published if no featured)
      let candidates = await this.contentRepo.find({
        where: { status: 'PUBLISHED', isFeatured: true },
        relations: ['movie', 'genres', 'languages'],
        order: { createdAt: 'DESC' },
        take: 12,
      });

      if (candidates.length === 0) {
        candidates = await this.contentRepo.find({
          where: { status: 'PUBLISHED' },
          relations: ['movie', 'genres', 'languages'],
          order: { createdAt: 'DESC' },
          take: 12,
        });
      }

      if (effTypeId > 0) {
        const filteredByType = candidates.filter((c) => {
          const cType = (c.type || c.contentTypeString || 'MOVIE').toUpperCase().trim();
          const cid = c.contentTypeId ? Number(c.contentTypeId) : (cType === 'MOVIE' ? 1 : cType === 'ALBUM' ? 2 : cType === 'SHORT_FILM' ? 3 : cType === 'MICRODRAMA' ? 4 : cType === 'PODCAST' ? 5 : cType === 'SERIES' ? 6 : 7);
          return cid === effTypeId;
        });
        if (filteredByType.length > 0) candidates = filteredByType;
      }

      if (language && language !== 'all') {
        const lLower = language.toLowerCase().trim();
        const lVariants = ['kn', 'kannada', 'kan'].includes(lLower)
          ? ['kn', 'kannada', 'kan']
          : ['hi', 'hindi', 'hin'].includes(lLower)
          ? ['hi', 'hindi', 'hin']
          : ['ta', 'tamil', 'tam'].includes(lLower)
          ? ['ta', 'tamil', 'tam']
          : [lLower];
        const filtered = candidates.filter((c) =>
          lVariants.includes(String(c.originalLanguageCode || '').toLowerCase().trim()),
        );
        if (filtered.length > 0) candidates = filtered;
      }

      return candidates.map((c, idx) => {
        const dto = ContentMapper.toDto(c);
        const img = dto.backdropUrl || dto.landscapeImageUrl || dto.posterUrl || '';
        return {
          id: c.id,
          banner_id: c.id,
          title: c.title,
          subtitle: c.shortDescription || c.description || '',
          imageUrl: img,
          image: img,
          landscape: img,
          mobileImageUrl: dto.posterUrl || img,
          thumbnail: dto.posterUrl || img,
          trailerUrl: c.trailerUrl || dto.trailerUrl || '',
          contentId: c.id,
          video_id: c.id,
          pageSlug,
          displayOrder: idx + 1,
          isActive: true,
          content: dto,
          ...dto,
        };
      });
    });
  }

  async getPageLayout(slug = 'home', language?: string, typeId?: number, type?: string): Promise<any> {
    const effTypeId = this.resolveEffectiveTypeId(typeId, type, slug);
    const cacheKey = `cms:page:${slug}:${language || 'all'}:${effTypeId}`;
    return this.redisService.getOrSet(cacheKey, 120, async () => {
      let pageTitle = 'Home';
      try {
        const page = await this.pageRepo.findOne({
          where: { slug: slug.toLowerCase() },
        });
        if (page?.title) pageTitle = page.title;
      } catch {}

      const banners = await this.getBanners(slug, language, effTypeId);
      const sections = await this.getSections(undefined, slug, language, effTypeId);

      return {
        id: 1,
        slug: slug || 'home',
        title: pageTitle,
        banners,
        sections,
        section_list: sections,
      };
    });
  }

  async getSections(pageId?: number, pageSlug = 'home', language?: string, typeId?: number, type?: string): Promise<any[]> {
    const effTypeId = this.resolveEffectiveTypeId(typeId, type, pageSlug);
    const result: any[] = [];
    try {
      const qb = this.sectionRepo
        .createQueryBuilder('sec')
        .leftJoinAndSelect('sec.items', 'item')
        .leftJoinAndSelect('item.content', 'c')
        .leftJoinAndSelect('c.movie', 'm')
        .leftJoinAndSelect('c.genres', 'g')
        .leftJoinAndSelect('c.languages', 'lang')
        .where('sec.isActive = :active', { active: true })
        .orderBy('sec.displayOrder', 'ASC')
        .addOrderBy('sec.id', 'ASC');

      if (pageId) {
        qb.andWhere('sec.pageId = :pageId', { pageId });
      }

      const sections = await qb.getMany();
      for (const sec of sections) {
        const dto = ContentMapper.toSectionDto(sec);
        result.push(dto);
      }

      if (effTypeId > 0 && result.length > 0) {
        for (const sec of result) {
          if (Array.isArray(sec.items)) {
            sec.items = sec.items.filter((item: any) => {
              if (effTypeId === 1) {
                const t = String(item.type || item.contentType || '').toUpperCase().trim();
                return t === 'MOVIE' || t === 'FILM' || item.typeId === 1 || item.videoType === 1;
              }
              return item.typeId === effTypeId || item.videoType === effTypeId;
            });
            sec.data = sec.items;
            sec.content_list = sec.items;
          }
        }
        const filtered = result.filter((sec) => sec.items && sec.items.length > 0);
        if (filtered.length > 0) return filtered;
      }
    } catch {}

    // If no CMS sections configured in DB yet (or none matched filter), synthesize clean categorized default rails from catalog
    const allPublished = await this.contentRepo.find({
      where: { status: 'PUBLISHED' },
      relations: ['movie', 'genres', 'languages'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    let mapped = allPublished.map((c) => ContentMapper.toDto(c));

    if (language && language !== 'all') {
      const lLower = language.toLowerCase().trim();
      const lVariants = ['kn', 'kannada', 'kan'].includes(lLower)
        ? ['kn', 'kannada', 'kan']
        : ['hi', 'hindi', 'hin'].includes(lLower)
        ? ['hi', 'hindi', 'hin']
        : ['ta', 'tamil', 'tam'].includes(lLower)
        ? ['ta', 'tamil', 'tam']
        : [lLower];
      const filtered = mapped.filter((item) =>
        lVariants.includes(String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim()),
      );
      if (filtered.length > 0) mapped = filtered;
    }

    if (mapped.length > 0) {
      const movies = mapped.filter((c) => {
        const t = (c.type || c.contentType || '').toUpperCase().trim();
        return t === 'MOVIE' || t === 'FILM' || c.typeId === 1 || c.videoType === 1;
      });
      const albums = mapped.filter((c) => (c.type || '').toUpperCase() === 'ALBUM');
      const microdramas = mapped.filter((c) => ['MICRODRAMA', 'AI_MICRODRAMA'].includes((c.type || '').toUpperCase()));
      const shortFilms = mapped.filter((c) => (c.type || '').toUpperCase() === 'SHORT_FILM');
      const podcasts = mapped.filter((c) => (c.type || '').toUpperCase() === 'PODCAST');
      const series = mapped.filter((c) => (c.type || '').toUpperCase() === 'SERIES');

      let order = 1;

      // 1. If filtering specifically by Movies (typeId = 1)
      if (effTypeId === 1) {
        if (movies.length > 0) {
          result.push({
            id: order,
            section_id: order,
            title: 'Blockbuster Movies',
            sectionType: 'CURATED',
            screen_layout: 'portrait',
            layoutStyle: 'portrait',
            displayOrder: order++,
            isActive: true,
            items: movies,
            data: movies,
            content_list: movies,
          });
          result.push({
            id: order,
            section_id: order,
            title: 'Top Trending Movies',
            sectionType: 'CURATED',
            screen_layout: 'landscape',
            layoutStyle: 'landscape',
            displayOrder: order++,
            isActive: true,
            items: movies.slice(0, 15),
            data: movies.slice(0, 15),
            content_list: movies.slice(0, 15),
          });
        }
        return result;
      }

      // 2. If filtering specifically by Songs / Music (typeId = 2)
      if (effTypeId === 2) {
        if (albums.length > 0) {
          result.push({
            id: order,
            section_id: order,
            title: 'Music & Songs Albums',
            sectionType: 'CURATED',
            screen_layout: 'landscape',
            layoutStyle: 'landscape',
            displayOrder: order++,
            isActive: true,
            items: albums,
            data: albums,
            content_list: albums,
          });
        }
        return result;
      }

      // 3. If filtering specifically by Short Films (typeId = 3)
      if (effTypeId === 3) {
        if (shortFilms.length > 0) {
          result.push({
            id: order,
            section_id: order,
            title: 'Short Films & Exclusives',
            sectionType: 'CURATED',
            screen_layout: 'landscape',
            layoutStyle: 'landscape',
            displayOrder: order++,
            isActive: true,
            items: shortFilms,
            data: shortFilms,
            content_list: shortFilms,
          });
        }
        return result;
      }

      // 4. If filtering specifically by Microdramas (typeId = 4)
      if (effTypeId === 4) {
        if (microdramas.length > 0) {
          result.push({
            id: order,
            section_id: order,
            title: 'Microdramas & Mini-Series',
            sectionType: 'CURATED',
            screen_layout: 'portrait',
            layoutStyle: 'portrait',
            displayOrder: order++,
            isActive: true,
            items: microdramas,
            data: microdramas,
            content_list: microdramas,
          });
        }
        return result;
      }

      // 5. If filtering specifically by Podcasts (typeId = 5)
      if (effTypeId === 5) {
        if (podcasts.length > 0) {
          result.push({
            id: order,
            section_id: order,
            title: 'Podcasts & Talk Shows',
            sectionType: 'CURATED',
            screen_layout: 'landscape',
            layoutStyle: 'landscape',
            displayOrder: order++,
            isActive: true,
            items: podcasts,
            data: podcasts,
            content_list: podcasts,
          });
        }
        return result;
      }

      // 6. If filtering specifically by Web Series (typeId = 6)
      if (effTypeId === 6) {
        if (series.length > 0) {
          result.push({
            id: order,
            section_id: order,
            title: 'Web Series & Shows',
            sectionType: 'CURATED',
            screen_layout: 'portrait',
            layoutStyle: 'portrait',
            displayOrder: order++,
            isActive: true,
            items: series,
            data: series,
            content_list: series,
          });
        }
        return result;
      }

      // 7. General Home Page: Curate distinct rails for each type without mixing
      // Rail 1: Trending across catalog
      result.push({
        id: order,
        section_id: order,
        title: 'Trending & New Releases',
        sectionType: 'CURATED',
        screen_layout: 'landscape',
        layoutStyle: 'landscape',
        displayOrder: order++,
        isActive: true,
        items: mapped.slice(0, 15),
        data: mapped.slice(0, 15),
        content_list: mapped.slice(0, 15),
      });

      // Rail 2: Movies rail
      if (movies.length > 0) {
        result.push({
          id: order,
          section_id: order,
          title: 'Blockbuster Movies',
          sectionType: 'CURATED',
          screen_layout: 'portrait',
          layoutStyle: 'portrait',
          displayOrder: order++,
          isActive: true,
          items: movies,
          data: movies,
          content_list: movies,
        });
      }

      // Rail 3: Songs & Albums rail
      if (albums.length > 0) {
        result.push({
          id: order,
          section_id: order,
          title: 'Music & Songs Albums',
          sectionType: 'CURATED',
          screen_layout: 'landscape',
          layoutStyle: 'landscape',
          displayOrder: order++,
          isActive: true,
          items: albums,
          data: albums,
          content_list: albums,
        });
      }

      // Rail 4: Microdramas rail
      if (microdramas.length > 0) {
        result.push({
          id: order,
          section_id: order,
          title: 'Microdramas & Mini-Series',
          sectionType: 'CURATED',
          screen_layout: 'portrait',
          layoutStyle: 'portrait',
          displayOrder: order++,
          isActive: true,
          items: microdramas,
          data: microdramas,
          content_list: microdramas,
        });
      }

      // Rail 5: Short films rail
      if (shortFilms.length > 0) {
        result.push({
          id: order,
          section_id: order,
          title: 'Short Films & Exclusives',
          sectionType: 'CURATED',
          screen_layout: 'landscape',
          layoutStyle: 'landscape',
          displayOrder: order++,
          isActive: true,
          items: shortFilms,
          data: shortFilms,
          content_list: shortFilms,
        });
      }

      // Rail 6: Podcasts rail
      if (podcasts.length > 0) {
        result.push({
          id: order,
          section_id: order,
          title: 'Podcasts & Talk Shows',
          sectionType: 'CURATED',
          screen_layout: 'landscape',
          layoutStyle: 'landscape',
          displayOrder: order++,
          isActive: true,
          items: podcasts,
          data: podcasts,
          content_list: podcasts,
        });
      }

      // Rail 7: Series rail
      if (series.length > 0) {
        result.push({
          id: order,
          section_id: order,
          title: 'Web Series & Shows',
          sectionType: 'CURATED',
          screen_layout: 'portrait',
          layoutStyle: 'portrait',
          displayOrder: order++,
          isActive: true,
          items: series,
          data: series,
          content_list: series,
        });
      }
    }

    return result;
  }

  // ==================== ADMIN CMS CRUD ====================

  async listPagesAdmin(): Promise<Page[]> {
    return this.pageRepo.find({
      relations: ['sections', 'sections.items', 'sections.items.content'],
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  async upsertPage(body: any, id?: number): Promise<Page> {
    const title = String(body?.title || body?.name || '').trim();
    if (!title) throw new BadRequestException('Page title is required');
    const slug = String(body?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();

    let page = id ? await this.pageRepo.findOne({ where: { id } }) : await this.pageRepo.findOne({ where: { slug } });
    if (!page) {
      page = this.pageRepo.create({
        title,
        slug,
        description: body?.description || null,
        iconUrl: body?.iconUrl || body?.icon_url || null,
        displayOrder: Number(body?.displayOrder ?? 0),
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      page.title = title;
      page.slug = slug;
      if (body.description !== undefined) page.description = body.description;
      if (body.iconUrl !== undefined) page.iconUrl = body.iconUrl;
      if (body.displayOrder !== undefined) page.displayOrder = Number(body.displayOrder);
      if (body.isActive !== undefined) page.isActive = Boolean(body.isActive);
    }

    const saved = await this.pageRepo.save(page);
    await this.redisService.delByPrefix('cms:');
    return saved;
  }

  async deletePage(id: number): Promise<any> {
    const page = await this.pageRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException(`Page ${id} not found`);
    await this.pageRepo.remove(page);
    await this.redisService.delByPrefix('cms:');
    return { id, deleted: true };
  }

  async listSectionsAdmin(pageId?: number): Promise<any[]> {
    const whereClause = pageId ? { pageId } : {};
    const sections = await this.sectionRepo.find({
      where: whereClause,
      relations: ['items', 'items.content', 'items.content.movie', 'items.content.series'],
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
    return sections.map((s) => ContentMapper.toSectionDto(s));
  }

  async upsertSection(body: any, id?: number): Promise<any> {
    const title = String(body?.title || body?.name || '').trim();
    if (!title) throw new BadRequestException('Section title is required');

    let section = id ? await this.sectionRepo.findOne({ where: { id } }) : null;
    if (!section) {
      section = this.sectionRepo.create({
        pageId: body?.pageId ? Number(body.pageId) : null,
        title,
        subtitle: body?.subtitle || null,
        sectionType: body?.sectionType || body?.section_type || 'CURATED',
        layoutStyle: body?.layoutStyle || body?.screen_layout || 'HORIZONTAL_POSTER',
        contentTypeFilter: body?.contentTypeFilter || null,
        categoryId: body?.categoryId ? Number(body.categoryId) : null,
        genreId: body?.genreId ? Number(body.genreId) : null,
        languageCode: body?.languageCode || null,
        autoFetchLimit: Number(body?.autoFetchLimit ?? 12),
        displayOrder: Number(body?.displayOrder ?? 0),
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      section.title = title;
      if (body.pageId !== undefined) section.pageId = body.pageId ? Number(body.pageId) : null;
      if (body.subtitle !== undefined) section.subtitle = body.subtitle;
      if (body.sectionType !== undefined) section.sectionType = body.sectionType;
      if (body.layoutStyle !== undefined || body.screen_layout !== undefined) {
        section.layoutStyle = body.layoutStyle ?? body.screen_layout;
      }
      if (body.contentTypeFilter !== undefined) section.contentTypeFilter = body.contentTypeFilter;
      if (body.categoryId !== undefined) section.categoryId = body.categoryId ? Number(body.categoryId) : null;
      if (body.genreId !== undefined) section.genreId = body.genreId ? Number(body.genreId) : null;
      if (body.languageCode !== undefined) section.languageCode = body.languageCode;
      if (body.autoFetchLimit !== undefined) section.autoFetchLimit = Number(body.autoFetchLimit);
      if (body.displayOrder !== undefined) section.displayOrder = Number(body.displayOrder);
      if (body.isActive !== undefined) section.isActive = Boolean(body.isActive);
    }

    const saved = await this.sectionRepo.save(section);

    // If contentIds array is passed, sync section_items
    const contentIds: number[] = Array.isArray(body?.contentIds)
      ? body.contentIds.map(Number).filter(Boolean)
      : [];
    if (Array.isArray(body?.contentIds)) {
      await this.sectionItemRepo.delete({ sectionId: saved.id });
      for (let i = 0; i < contentIds.length; i++) {
        await this.sectionItemRepo.save(
          this.sectionItemRepo.create({
            sectionId: saved.id,
            contentId: contentIds[i],
            displayOrder: i + 1,
          }),
        );
      }
    }

    await this.redisService.delByPrefix('cms:');
    const reloaded = await this.sectionRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.content'],
    });
    return ContentMapper.toSectionDto(reloaded!);
  }

  async deleteSection(id: number): Promise<any> {
    const section = await this.sectionRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException(`Section ${id} not found`);
    await this.sectionItemRepo.delete({ sectionId: id });
    await this.sectionRepo.remove(section);
    await this.redisService.delByPrefix('cms:');
    return { id, deleted: true };
  }

  async listBannersAdmin(): Promise<any[]> {
    const banners = await this.bannerRepo.find({
      relations: ['content'],
      order: { displayOrder: 'ASC', id: 'DESC' },
    });
    return banners.map((b) => ContentMapper.toBannerDto(b));
  }

  async upsertBanner(body: any, id?: number): Promise<any> {
    let banner = id ? await this.bannerRepo.findOne({ where: { id } }) : null;
    const imageUrl = body?.imageUrl || body?.image_url || body?.image || body?.landscape || '';
    if (!banner && !imageUrl && !body?.contentId) {
      throw new BadRequestException('Banner imageUrl or contentId is required');
    }

    if (!banner) {
      banner = this.bannerRepo.create({
        title: body?.title || 'Featured Banner',
        subtitle: body?.subtitle || null,
        imageUrl: imageUrl || '',
        mobileImageUrl: body?.mobileImageUrl || body?.mobile_image_url || imageUrl || null,
        trailerUrl: body?.trailerUrl || body?.trailer_url || null,
        targetUrl: body?.targetUrl || body?.target_url || null,
        contentId: body?.contentId || body?.video_id ? Number(body.contentId || body.video_id) : null,
        pageSlug: body?.pageSlug || 'home',
        displayOrder: Number(body?.displayOrder ?? 0),
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      if (body.title !== undefined) banner.title = body.title;
      if (body.subtitle !== undefined) banner.subtitle = body.subtitle;
      if (imageUrl) banner.imageUrl = imageUrl;
      if (body.mobileImageUrl !== undefined) banner.mobileImageUrl = body.mobileImageUrl;
      if (body.trailerUrl !== undefined) banner.trailerUrl = body.trailerUrl;
      if (body.targetUrl !== undefined) banner.targetUrl = body.targetUrl;
      if (body.contentId !== undefined || body.video_id !== undefined) {
        banner.contentId = (body.contentId ?? body.video_id) ? Number(body.contentId ?? body.video_id) : null;
      }
      if (body.pageSlug !== undefined) banner.pageSlug = body.pageSlug;
      if (body.displayOrder !== undefined) banner.displayOrder = Number(body.displayOrder);
      if (body.isActive !== undefined) banner.isActive = Boolean(body.isActive);
    }

    const saved = await this.bannerRepo.save(banner);
    await this.redisService.delByPrefix('cms:');
    const reloaded = await this.bannerRepo.findOne({
      where: { id: saved.id },
      relations: ['content'],
    });
    return ContentMapper.toBannerDto(reloaded!);
  }

  async deleteBanner(id: number): Promise<any> {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner ${id} not found`);
    await this.bannerRepo.remove(banner);
    await this.redisService.delByPrefix('cms:');
    return { id, deleted: true };
  }
}

