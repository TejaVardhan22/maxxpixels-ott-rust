import { ApiClient } from './apiClient';
import { AuthService } from './authService';
import { CatalogCategory, CatalogContentType, CatalogItem, CatalogLanguage, HomeSection, parseCatalogItem } from '../types';
import { HomeCatalogResult } from './catalogService';
import { AppConfig } from '../core/config';

export const GET_HOME_CATALOG_QUERY = `
  query GetHomeCatalog($typeId: Int, $language: String) {
    homeCatalog(typeId: $typeId, language: $language) {
      banners {
        id
        title
        subtitle
        imageUrl
        mobileImageUrl
        contentId
        pageSlug
        content {
          id
          title
          slug
          description
          posterUrl
          bannerUrl
          trailerUrl
          videoType
          typeId
          rating
          duration
          releaseYear
          isPremium
          genres
          languages
        }
      }
      sections {
        id
        title
        videoType
        landscape
        items {
          id
          title
          slug
          description
          posterUrl
          bannerUrl
          trailerUrl
          videoType
          typeId
          rating
          duration
          releaseYear
          isPremium
          genres
          languages
        }
      }
      categories {
        id
        name
        slug
        imageUrl
        typeId
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
  query GetContentDetail($id: ID, $slug: String) {
    contentDetail(id: $id, slug: $slug) {
      id
      title
      slug
      description
      posterUrl
      bannerUrl
      trailerUrl
      videoUrl
      videoType
      typeId
      rating
      duration
      releaseYear
      isPremium
      isRented
      isWatchlisted
      genres
      languages
      episodes {
        id
        title
        description
        episodeNumber
        seasonNumber
        duration
        thumbnailUrl
        videoUrl
      }
      cast {
        id
        name
        characterName
        role
        imageUrl
      }
      relatedContent {
        id
        title
        slug
        description
        posterUrl
        bannerUrl
        videoType
        typeId
        rating
        duration
      }
    }
  }
`;

export const SEARCH_CONTENT_QUERY = `
  query SearchContent($query: String!, $limit: Int) {
    searchContent(query: $query, limit: $limit) {
      id
      title
      slug
      description
      posterUrl
      bannerUrl
      trailerUrl
      videoType
      typeId
      rating
      duration
      releaseYear
      isPremium
      genres
      languages
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
    const data = await ApiClient.executeGraphQL<{ homeCatalog: any }>(
      GET_HOME_CATALOG_QUERY,
      {
        typeId: typeId > 0 ? typeId : undefined,
        language: lang || undefined,
      },
      { userToken: AuthService.authToken || undefined }
    );

    const catalog = data?.homeCatalog;
    if (!catalog) {
      throw new Error('GraphQL returned empty homeCatalog payload');
    }

    const banners: CatalogItem[] = (catalog.banners || []).map((b: any) =>
      parseCatalogItem({
        id: b.contentId || b.id,
        name: b.title,
        title: b.title,
        description: b.subtitle || b.content?.description,
        landscape: b.imageUrl || b.mobileImageUrl,
        poster: b.mobileImageUrl || b.imageUrl,
        videoType: b.content?.videoType || 1,
        typeId: b.content?.typeId || 1,
        rating: b.content?.rating || 0,
        releaseYear: b.content?.releaseYear,
        isPremium: b.content?.isPremium ? 1 : 0,
        genres: b.content?.genres,
      })
    );

    const sections: HomeSection[] = (catalog.sections || []).map((s: any, idx: number) => ({
      id: Number(s.id || idx + 1),
      title: s.title || '',
      videoType: Number(s.videoType || 1),
      landscape: Boolean(s.landscape),
      data: (s.items || []).map((item: any) =>
        parseCatalogItem({
          id: item.id,
          name: item.title,
          title: item.title,
          slug: item.slug,
          description: item.description,
          poster: item.posterUrl,
          landscape: item.bannerUrl,
          videoType: item.videoType || 1,
          typeId: item.typeId || 1,
          rating: item.rating || 0,
          duration: item.duration,
          releaseYear: item.releaseYear,
          isPremium: item.isPremium ? 1 : 0,
          genres: item.genres,
        })
      ),
    }));

    const categories: CatalogCategory[] = (catalog.categories || []).map((c: any) => ({
      id: Number(c.id),
      name: c.name || '',
      typeId: Number(c.typeId || 0),
      image: AppConfig.normalizeMediaUrl(c.imageUrl || ''),
    }));

    const defaultTypes: CatalogContentType[] = [
      { id: 1, name: 'Movies' },
      { id: 2, name: 'Songs' },
      { id: 3, name: 'Short Films' },
      { id: 4, name: 'Micro-Drama' },
      { id: 5, name: 'Podcasts' },
      { id: 6, name: 'Web Series' },
    ];

    return {
      banners: banners.length > 0 ? banners : sections[0]?.data.slice(0, 6) || [],
      sections,
      categories,
      types: defaultTypes,
      errors: [],
      latest: sections.find((s) => /recent|new/i.test(s.title))?.data || [],
    };
  }

  /**
   * Fetch movie or series detail via GraphQL
   */
  public static async getContentDetail(idOrSlug: string | number): Promise<CatalogItem | null> {
    const raw = String(idOrSlug || '').trim();
    if (!raw) return null;

    const isNumeric = /^\d+$/.test(raw);
    const variables = isNumeric ? { id: raw } : { slug: raw };

    const data = await ApiClient.executeGraphQL<{ contentDetail: any }>(
      GET_CONTENT_DETAIL_QUERY,
      variables,
      { userToken: AuthService.authToken || undefined }
    );

    const detail = data?.contentDetail;
    if (!detail) return null;

    return parseCatalogItem({
      id: detail.id,
      name: detail.title,
      title: detail.title,
      slug: detail.slug,
      description: detail.description,
      poster: detail.posterUrl,
      landscape: detail.bannerUrl,
      trailerUrl: detail.trailerUrl,
      videoUrl: detail.videoUrl,
      videoType: detail.videoType || 1,
      typeId: detail.typeId || 1,
      rating: detail.rating || 0,
      duration: detail.duration,
      releaseYear: detail.releaseYear,
      isPremium: detail.isPremium ? 1 : 0,
      isRent: detail.isRented ? 1 : 0,
      genres: detail.genres,
      languages: detail.languages,
      episodes: detail.episodes,
      cast: detail.cast,
      relatedContent: detail.relatedContent,
    });
  }

  /**
   * Search content via GraphQL
   */
  public static async searchContent(query: string, limit = 20): Promise<CatalogItem[]> {
    if (!query || !query.trim()) return [];

    const data = await ApiClient.executeGraphQL<{ searchContent: any[] }>(
      SEARCH_CONTENT_QUERY,
      { query: query.trim(), limit },
      { userToken: AuthService.authToken || undefined }
    );

    return (data?.searchContent || []).map((item) =>
      parseCatalogItem({
        id: item.id,
        name: item.title,
        title: item.title,
        slug: item.slug,
        description: item.description,
        poster: item.posterUrl,
        landscape: item.bannerUrl,
        videoType: item.videoType || 1,
        typeId: item.typeId || 1,
        rating: item.rating || 0,
        releaseYear: item.releaseYear,
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

