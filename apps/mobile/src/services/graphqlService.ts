import { ApiClient } from './apiClient';
import { AuthService } from './authService';
import { CatalogCategory, CatalogContentType, CatalogItem, CatalogLanguage, HomeSection, parseCatalogItem } from '../types';
import { HomeCatalogResult } from './catalogService';
import { AppConfig } from '../core/config';

export const GET_HOME_CATALOG_QUERY = `
  query GetMobileHome($platform: String, $language: String) {
    home(platform: $platform, language: $language) {
      banners {
        id
        title
        subtitle
        imageUrl
        mobileImageUrl
        actionUrl
        contentId
        displayOrder
        platform
      }
      sections {
        id
        title
        subtitle
        layout
        items {
          id
          title
          slug
          contentType
          description
          posterUrl
          bannerUrl
          backdropUrl
          trailerUrl
          language
          releaseYear
          ageRating
          durationSeconds
          monetization
          accessType
          isPremium
          isFeatured
          isTrending
          rentPrice
          viewCount
        }
      }
      featured {
        id
        title
        slug
        contentType
        description
        posterUrl
        bannerUrl
        backdropUrl
        trailerUrl
        language
        releaseYear
        durationSeconds
        accessType
        isPremium
      }
      trending {
        id
        title
        slug
        contentType
        description
        posterUrl
        bannerUrl
        backdropUrl
        trailerUrl
        language
        releaseYear
        durationSeconds
        accessType
        isPremium
      }
      contentTypes {
        id
        name
        title
        slug
        displayOrder
      }
      categories {
        id
        name
        slug
      }
      languages {
        id
        name
        code
        nativeName
      }
    }
  }
`;

export const GET_CONTENT_DETAIL_QUERY = `
  query GetContentDetail($idOrSlug: String!) {
    content(idOrSlug: $idOrSlug) {
      id
      title
      slug
      contentType
      status
      description
      shortDescription
      posterUrl
      bannerUrl
      backdropUrl
      trailerUrl
      language
      releaseYear
      releaseDate
      ageRating
      durationSeconds
      durationMinutes
      monetization
      accessType
      isPremium
      rentPrice
      viewCount
      masterPlaylistUrl
      categories
      genres
      seasons {
        id
        seasonNumber
        title
        description
        posterUrl
        releaseDate
        episodes {
          id
          episodeNumber
          title
          description
          thumbnailUrl
          hlsUrl
          videoUrl
          durationSeconds
          isFreePreview
          releaseDate
        }
      }
    }
  }
`;

export const SEARCH_CONTENT_QUERY = `
  query SearchContent($query: String, $limit: Int) {
    browse(query: $query, size: $limit) {
      total
      hasMore
      items {
        id
        title
        slug
        contentType
        description
        posterUrl
        bannerUrl
        backdropUrl
        trailerUrl
        language
        releaseYear
        durationSeconds
        accessType
        isPremium
      }
    }
  }
`;

export const GET_USER_PROFILE_QUERY = `
  query GetUserProfile {
    me {
      id
      name
      email
      phone
      avatarUrl
      role
      activeSubscription {
        id
        planId
        planName
        status
        startsAt
        expiresAt
      }
      subProfiles {
        id
        name
        avatarUrl
        isKids
        isPinProtected
      }
    }
  }
`;

export const GET_PLAYBACK_STREAM_QUERY = `
  query GetPlaybackStream($contentId: ID!, $episodeId: ID) {
    playbackStream(contentId: $contentId, episodeId: $episodeId) {
      contentId
      title
      streamUrl
      videoUrl
      token
      drmEnabled
      drmLicenseUrl
      adTags
    }
  }
`;

export const UPDATE_WATCH_PROGRESS_MUTATION = `
  mutation UpdateWatchProgress($input: WatchProgressInput!) {
    updateWatchProgress(input: $input)
  }
`;

export const GET_SUBSCRIPTION_PLANS_QUERY = `
  query GetSubscriptionPlans {
    subscriptionPlans {
      id
      name
      description
      price
      currency
      durationDays
      maxScreens
      quality
      features
      isActive
    }
  }
`;

export class GraphQLService {
  /**
   * Execute consolidated Home Catalog query in a single GraphQL network round-trip.
   */
  public static async getHomeCatalog(typeId: number = 0, lang?: string): Promise<HomeCatalogResult> {
    const data = await ApiClient.executeGraphQL<{ home: any }>(
      GET_HOME_CATALOG_QUERY,
      {
        platform: 'MOBILE',
        language: lang || '',
      },
      { userToken: AuthService.authToken || undefined }
    );

    const catalog = data?.home;
    if (!catalog) {
      throw new Error('GraphQL returned empty home payload');
    }

    const mapItem = (item: any): CatalogItem =>
      parseCatalogItem({
        id: item.id,
        name: item.title,
        title: item.title,
        slug: item.slug,
        contentType: item.contentType,
        type: item.contentType,
        description: item.description,
        poster: AppConfig.normalizeMediaUrl(item.posterUrl || ''),
        landscape: AppConfig.normalizeMediaUrl(item.bannerUrl || item.backdropUrl || item.posterUrl || ''),
        trailerUrl: item.trailerUrl,
        videoType: String(item.contentType || '').toUpperCase() === 'SERIES' ? 6 : 1,
        typeId: String(item.contentType || '').toUpperCase() === 'SERIES' ? 6 : 1,
        duration: item.durationSeconds,
        releaseYear: item.releaseYear,
        isPremium: item.isPremium ? 1 : 0,
        genres: item.genres,
      });

    const banners: CatalogItem[] = (catalog.banners || []).map((b: any) =>
      parseCatalogItem({
        id: b.contentId || b.id,
        name: b.title,
        title: b.title,
        description: b.subtitle,
        landscape: AppConfig.normalizeMediaUrl(b.mobileImageUrl || b.imageUrl || ''),
        poster: AppConfig.normalizeMediaUrl(b.mobileImageUrl || b.imageUrl || ''),
        videoType: 1,
        typeId: 1,
      })
    );

    const sections: HomeSection[] = (catalog.sections || [])
      .map((s: any, idx: number) => ({
        id: Number(s.id || idx + 1),
        title: s.title || '',
        videoType: 1,
        landscape: String(s.layout || '').toUpperCase() === 'HORIZONTAL',
        data: (s.items || []).map(mapItem),
      }))
      .filter((s: HomeSection) => s.data.length > 0);

    const trendingItems: CatalogItem[] = (catalog.trending || []).map(mapItem);
    const featuredItems: CatalogItem[] = (catalog.featured || []).map(mapItem);

    if (sections.length === 0 && trendingItems.length > 0) {
      sections.push({ id: 901, title: 'Trending Now', videoType: 1, landscape: false, data: trendingItems });
    }
    if (sections.length <= 1 && featuredItems.length > 0) {
      sections.push({ id: 902, title: 'Featured Picks', videoType: 1, landscape: true, data: featuredItems });
    }

    const categories: CatalogCategory[] = (catalog.categories || []).map((c: any) => ({
      id: Number(c.id),
      name: c.name || '',
      typeId: 0,
      image: '',
    }));

    const types: CatalogContentType[] =
      Array.isArray(catalog.contentTypes) && catalog.contentTypes.length > 0
        ? catalog.contentTypes.map((t: any) => ({
            id: Number(t.id || 1),
            name: t.name || t.title || t.slug || 'Category',
          }))
        : [];

    const matchesType = (item: CatalogItem) => (typeId === 0 ? true : item.typeId === typeId || item.videoType === typeId);

    return {
      banners: (banners.length > 0 ? banners : featuredItems.slice(0, 6)).filter(matchesType),
      sections: typeId === 0 ? sections : sections.map((s) => ({ ...s, data: s.data.filter(matchesType) })).filter((s) => s.data.length > 0),
      categories,
      types,
      errors: [],
      latest: trendingItems.length > 0 ? trendingItems : sections[0]?.data || [],
    };
  }

  /**
   * Fetch movie or series detail (with nested seasons & episodes) via Go GraphQL
   */
  public static async getContentDetail(idOrSlug: string | number): Promise<CatalogItem | null> {
    const raw = String(idOrSlug || '').trim();
    if (!raw) return null;

    const data = await ApiClient.executeGraphQL<{ content: any }>(
      GET_CONTENT_DETAIL_QUERY,
      { idOrSlug: raw },
      { userToken: AuthService.authToken || undefined }
    );

    const detail = data?.content;
    if (!detail) return null;

    const flattenedEpisodes = Array.isArray(detail.seasons)
      ? detail.seasons.flatMap((s: any) =>
          (s.episodes || []).map((ep: any) => ({
            ...ep,
            seasonId: s.id,
            seasonNumber: s.seasonNumber,
            duration: ep.durationSeconds,
            videoUrl: ep.hlsUrl || ep.videoUrl,
          }))
        )
      : [];

    return parseCatalogItem({
      id: detail.id,
      name: detail.title,
      title: detail.title,
      slug: detail.slug,
      contentType: detail.contentType,
      description: detail.description,
      poster: AppConfig.normalizeMediaUrl(detail.posterUrl || ''),
      landscape: AppConfig.normalizeMediaUrl(detail.bannerUrl || detail.backdropUrl || ''),
      trailerUrl: detail.trailerUrl,
      videoUrl: detail.masterPlaylistUrl,
      videoType: String(detail.contentType || '').toUpperCase() === 'SERIES' ? 6 : 1,
      typeId: String(detail.contentType || '').toUpperCase() === 'SERIES' ? 6 : 1,
      duration: detail.durationSeconds,
      releaseYear: detail.releaseYear,
      isPremium: detail.isPremium ? 1 : 0,
      genres: detail.genres,
      seasons: detail.seasons,
      episodes: flattenedEpisodes,
    });
  }

  /**
   * Search content via Go GraphQL
   */
  public static async searchContent(query: string, limit = 20): Promise<CatalogItem[]> {
    if (!query || !query.trim()) return [];

    const data = await ApiClient.executeGraphQL<{ browse: { items: any[] } }>(
      SEARCH_CONTENT_QUERY,
      { query: query.trim(), limit },
      { userToken: AuthService.authToken || undefined }
    );

    return (data?.browse?.items || []).map((item) =>
      parseCatalogItem({
        id: item.id,
        name: item.title,
        title: item.title,
        slug: item.slug,
        contentType: item.contentType,
        description: item.description,
        poster: AppConfig.normalizeMediaUrl(item.posterUrl || ''),
        landscape: AppConfig.normalizeMediaUrl(item.bannerUrl || item.backdropUrl || ''),
        videoType: String(item.contentType || '').toUpperCase() === 'SERIES' ? 6 : 1,
        typeId: String(item.contentType || '').toUpperCase() === 'SERIES' ? 6 : 1,
        releaseYear: item.releaseYear,
        isPremium: item.isPremium ? 1 : 0,
      })
    );
  }

  /**
   * Fetch authenticated user profile with active subscription and family sub-profiles.
   */
  public static async getUserProfile(): Promise<any> {
    const data = await ApiClient.executeGraphQL<{ me: any }>(
      GET_USER_PROFILE_QUERY,
      undefined,
      { userToken: AuthService.authToken || undefined }
    );
    return data?.me;
  }

  /**
   * Request authorized playback stream URL, token, DRM policy and VAST ad tags.
   */
  public static async getPlaybackStream(contentId: string | number, episodeId?: string | number): Promise<any> {
    const data = await ApiClient.executeGraphQL<{ playbackStream: any }>(
      GET_PLAYBACK_STREAM_QUERY,
      {
        contentId: String(contentId),
        episodeId: episodeId ? String(episodeId) : undefined,
      },
      { userToken: AuthService.authToken || undefined }
    );
    return data?.playbackStream;
  }

  /**
   * Report watch progress and resume point via GraphQL mutation
   */
  public static async updateWatchProgress(
    contentId: string | number,
    progressMs: number,
    durationMs: number,
    episodeId?: string | number
  ): Promise<boolean> {
    const data = await ApiClient.executeGraphQL<{ updateWatchProgress: boolean }>(
      UPDATE_WATCH_PROGRESS_MUTATION,
      {
        input: {
          contentId: String(contentId),
          episodeId: episodeId ? String(episodeId) : undefined,
          progressMs: Math.round(progressMs),
          durationMs: Math.round(durationMs),
        },
      },
      { userToken: AuthService.authToken || undefined }
    );
    return Boolean(data?.updateWatchProgress);
  }

  /**
   * Fetch active subscription plans via GraphQL
   */
  public static async getSubscriptionPlans(): Promise<any[]> {
    const data = await ApiClient.executeGraphQL<{ subscriptionPlans: any[] }>(
      GET_SUBSCRIPTION_PLANS_QUERY
    );
    return data?.subscriptionPlans || [];
  }
}

