import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { Public, CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { CatalogService } from '../../content/services/catalog.service';
import { CmsService } from '../../content/services/cms.service';
import { MasterDataService } from '../../categories/services/master-data.service';
import {
  CategoryType,
  ContentDetailType,
  ContentItemType,
  EpisodeItemType,
  HomeCatalogType,
  LanguageType,
} from '../types/catalog.types';

@Resolver()
export class CatalogResolver {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly cmsService: CmsService,
    private readonly masterDataService: MasterDataService,
  ) {}

  @Public()
  @Query(() => HomeCatalogType, { description: 'Get consolidated Home page banners, sections, categories & languages' })
  async homeCatalog(
    @Args('typeId', { type: () => Int, nullable: true }) typeId?: number,
    @Args('language', { type: () => String, nullable: true }) language?: string,
  ): Promise<HomeCatalogType> {
    const [bannersRaw, sectionsRaw, categoriesRaw] = await Promise.all([
      this.cmsService.getBanners('home', language).catch(() => []),
      this.cmsService.getSections(undefined, 'home', language).catch(() => []),
      this.masterDataService.listCategories(true).catch(() => []),
    ]);

    const mappedBanners = (bannersRaw || []).map((b: any) => ({
      id: String(b.id || b.banner_id || b.contentId),
      title: b.title || b.name || '',
      subtitle: b.subtitle || '',
      imageUrl: b.imageUrl || b.image || '',
      mobileImageUrl: b.mobileImageUrl || b.imageUrl || '',
      contentId: String(b.contentId || b.id),
      pageSlug: b.pageSlug || 'home',
      content: b.content
        ? {
            id: String(b.content.id),
            title: b.content.title,
            slug: b.content.slug,
            description: b.content.description,
            posterUrl: b.content.posterUrl,
            bannerUrl: b.content.bannerUrl,
            trailerUrl: b.content.trailerUrl,
            videoType: Number(b.content.videoType || 1),
            typeId: Number(b.content.typeId || 1),
            rating: Number(b.content.rating || 0),
            duration: Number(b.content.duration || 0),
            releaseYear: b.content.releaseYear ? Number(b.content.releaseYear) : undefined,
            isPremium: Boolean(b.content.isPremium),
            genres: b.content.genres || [],
            languages: b.content.languages || [],
          }
        : undefined,
    }));

    const mappedSections = (sectionsRaw || []).map((s: any, idx: number) => {
      const items = Array.isArray(s.items) ? s.items : Array.isArray(s.data) ? s.data : [];
      return {
        id: String(s.id || idx + 1),
        title: s.title || s.name || '',
        videoType: Number(s.videoType || 1),
        landscape: Boolean(s.landscape || s.layout === 'HORIZONTAL' || s.screenLayout === 'landscape'),
        items: items.map((item: any) => ({
          id: String(item.id || item.contentId),
          title: item.title || item.name || '',
          slug: item.slug || '',
          description: item.description || '',
          posterUrl: item.posterUrl || item.imageUrl || item.image || '',
          bannerUrl: item.bannerUrl || item.landscapeUrl || item.imageUrl || '',
          trailerUrl: item.trailerUrl || '',
          videoType: Number(item.videoType || 1),
          typeId: Number(item.typeId || 1),
          rating: Number(item.rating || 0),
          duration: Number(item.duration || 0),
          releaseYear: item.releaseYear ? Number(item.releaseYear) : undefined,
          isPremium: Boolean(item.isPremium),
          genres: Array.isArray(item.genres) ? item.genres : [],
          languages: Array.isArray(item.languages) ? item.languages : [],
        })),
      };
    });

    const mappedCategories: CategoryType[] = (categoriesRaw || []).map((c: any) => ({
      id: String(c.id),
      name: c.name || '',
      slug: c.slug || '',
      imageUrl: c.imageUrl || c.image || '',
      typeId: Number(c.typeId || 0),
    }));

    return {
      banners: mappedBanners,
      sections: mappedSections,
      categories: mappedCategories,
      languages: [
        { id: '1', name: 'Kannada', code: 'kn', nativeName: 'ಕನ್ನಡ' },
        { id: '2', name: 'Telugu', code: 'te', nativeName: 'తెలుగు' },
        { id: '3', name: 'Tamil', code: 'ta', nativeName: 'தமிழ்' },
        { id: '4', name: 'Malayalam', code: 'ml', nativeName: 'മലയാളം' },
        { id: '5', name: 'Hindi', code: 'hi', nativeName: 'हिन्दी' },
        { id: '6', name: 'English', code: 'en', nativeName: 'English' },
      ],
    };
  }

  @Public()
  @Query(() => ContentDetailType, { description: 'Get detailed information about a movie or series' })
  async contentDetail(
    @Args('id', { type: () => ID, nullable: true }) id?: string,
    @Args('slug', { type: () => String, nullable: true }) slug?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ContentDetailType> {
    const target = id || slug;
    if (!target) {
      throw new Error('Either id or slug must be provided');
    }
    const raw = await this.catalogService.getContentDetail(target, user?.id);

    return {
      id: String(raw.id),
      title: raw.title || '',
      slug: raw.slug || '',
      description: raw.description || '',
      posterUrl: raw.posterUrl || '',
      bannerUrl: raw.bannerUrl || '',
      trailerUrl: raw.trailerUrl || '',
      videoUrl: raw.videoUrl || '',
      videoType: Number(raw.videoType || (raw.type === 'SERIES' ? 2 : 1)),
      typeId: Number(raw.typeId || 1),
      rating: Number(raw.rating || 0),
      duration: Number(raw.duration || 0),
      releaseYear: raw.releaseYear ? Number(raw.releaseYear) : undefined,
      isPremium: Boolean(raw.isPremium),
      isRented: Boolean(raw.isRented),
      isWatchlisted: Boolean(raw.isWatchlisted),
      genres: Array.isArray(raw.genres) ? raw.genres : [],
      languages: Array.isArray(raw.languages) ? raw.languages : [],
      episodes: (raw.episodes || []).map((ep: any) => ({
        id: String(ep.id),
        title: ep.title || '',
        description: ep.description || '',
        episodeNumber: Number(ep.episodeNumber || 1),
        seasonNumber: Number(ep.seasonNumber || 1),
        duration: Number(ep.duration || 0),
        thumbnailUrl: ep.thumbnailUrl || ep.posterUrl || '',
        videoUrl: ep.videoUrl || '',
      })),
      cast: (raw.cast || []).map((cm: any) => ({
        id: String(cm.id || cm.personId),
        name: cm.name || cm.person?.name || '',
        characterName: cm.characterName || '',
        role: cm.role || 'ACTOR',
        imageUrl: cm.imageUrl || cm.person?.imageUrl || '',
      })),
      relatedContent: (raw.relatedContent || []).map((rc: any) => ({
        id: String(rc.id),
        title: rc.title || '',
        slug: rc.slug || '',
        description: rc.description || '',
        posterUrl: rc.posterUrl || '',
        bannerUrl: rc.bannerUrl || '',
        trailerUrl: rc.trailerUrl || '',
        videoType: Number(rc.videoType || 1),
        typeId: Number(rc.typeId || 1),
        rating: Number(rc.rating || 0),
        duration: Number(rc.duration || 0),
        releaseYear: rc.releaseYear ? Number(rc.releaseYear) : undefined,
        isPremium: Boolean(rc.isPremium),
        genres: Array.isArray(rc.genres) ? rc.genres : [],
        languages: Array.isArray(rc.languages) ? rc.languages : [],
      })),
    };
  }

  @Public()
  @Query(() => [ContentItemType], { description: 'Search content catalog by title, description or genre' })
  async searchContent(
    @Args('query', { type: () => String }) query: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<ContentItemType[]> {
    const pageResult = await this.catalogService.browseCatalog({
      search: query,
      size: limit || 20,
    });
    return (pageResult.content || []).map((c: any) => ({
      id: String(c.id),
      title: c.title || '',
      slug: c.slug || '',
      description: c.description || '',
      posterUrl: c.posterUrl || '',
      bannerUrl: c.bannerUrl || '',
      trailerUrl: c.trailerUrl || '',
      videoType: Number(c.videoType || 1),
      typeId: Number(c.typeId || 1),
      rating: Number(c.rating || 0),
      duration: Number(c.duration || 0),
      releaseYear: c.releaseYear ? Number(c.releaseYear) : undefined,
      isPremium: Boolean(c.isPremium),
      genres: Array.isArray(c.genres) ? c.genres : [],
      languages: Array.isArray(c.languages) ? c.languages : [],
    }));
  }

  @Public()
  @Query(() => [CategoryType], { description: 'List all active catalog categories' })
  async categories(@Args('typeId', { type: () => Int, nullable: true }) typeId?: number): Promise<CategoryType[]> {
    const categories = await this.masterDataService.listCategories(true);
    let filtered = categories || [];
    if (typeId !== undefined && typeId !== null && typeId > 0) {
      filtered = filtered.filter((c: any) => Number(c.typeId) === typeId);
    }
    return filtered.map((c: any) => ({
      id: String(c.id),
      name: c.name || '',
      slug: c.slug || '',
      imageUrl: c.imageUrl || c.image || '',
      typeId: Number(c.typeId || 0),
    }));
  }

  @Public()
  @Query(() => [LanguageType], { description: 'List available audio languages' })
  async languages(): Promise<LanguageType[]> {
    return [
      { id: '1', name: 'Kannada', code: 'kn', nativeName: 'ಕನ್ನಡ' },
      { id: '2', name: 'Telugu', code: 'te', nativeName: 'తెలుగు' },
      { id: '3', name: 'Tamil', code: 'ta', nativeName: 'தமிழ்' },
      { id: '4', name: 'Malayalam', code: 'ml', nativeName: 'മലയാളം' },
      { id: '5', name: 'Hindi', code: 'hi', nativeName: 'हिन्दी' },
      { id: '6', name: 'English', code: 'en', nativeName: 'English' },
    ];
  }

  @Public()
  @Query(() => [EpisodeItemType], { description: 'Get episodes for a series' })
  async episodes(
    @Args('seriesId', { type: () => ID }) seriesId: string,
    @Args('seasonId', { type: () => ID, nullable: true }) seasonId?: string,
  ): Promise<EpisodeItemType[]> {
    if (seasonId) {
      const eps = await this.catalogService.getEpisodesBySeason(Number(seasonId));
      return (eps || []).map((ep: any) => ({
        id: String(ep.id),
        title: ep.title || '',
        description: ep.description || '',
        episodeNumber: Number(ep.episodeNumber || 1),
        seasonNumber: Number(ep.seasonNumber || 1),
        duration: Number(ep.duration || 0),
        thumbnailUrl: ep.thumbnailUrl || ep.posterUrl || '',
        videoUrl: ep.videoUrl || '',
      }));
    }
    const seasons = await this.catalogService.getSeasonsBySeries(Number(seriesId));
    const allEpisodes: EpisodeItemType[] = [];
    for (const season of seasons) {
      for (const ep of season.episodes || []) {
        allEpisodes.push({
          id: String(ep.id),
          title: ep.title || '',
          description: ep.description || '',
          episodeNumber: Number(ep.episodeNumber || 1),
          seasonNumber: Number(season.seasonNumber || 1),
          duration: Number(ep.duration || 0),
          thumbnailUrl: ep.thumbnailUrl || ep.posterUrl || '',
          videoUrl: ep.videoUrl || '',
        });
      }
    }
    return allEpisodes;
  }
}

