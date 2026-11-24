'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { catalogApi, type SessionContext, payload } from '../api/services';
import { queryKeys } from '../queryKeys';
import type {
  ApiListResponse,
  Banner,
  Category,
  ContentItem,
  IntroVideo,
  PortalBanner,
  Section,
} from '../types/models';

export function useGeneralSettings() {
  return useQuery({
    queryKey: queryKeys.generalSettings,
    queryFn: () => catalogApi.generalSetting(),
    staleTime: 5 * 60_000,
  });
}

export function useBanners(
  isHomeScreen: number,
  typeId: number,
  ctx?: SessionContext,
  opts?: { initialData?: ApiListResponse<Banner[]> },
) {
  return useQuery({
    queryKey: [...queryKeys.banners(isHomeScreen, typeId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: () => catalogApi.getBanner(payload.banner(isHomeScreen, typeId, ctx)),
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
    initialData: opts?.initialData,
  });
}

export function usePortalBanners(portalKey = 'all') {
  return useQuery({
    queryKey: queryKeys.portalBanners(portalKey),
    queryFn: () => catalogApi.getPortalBanners(portalKey),
    staleTime: 5 * 60_000,
  });
}

export function useIntroVideo() {
  return useQuery({
    queryKey: queryKeys.introVideo,
    queryFn: () => catalogApi.getIntroVideo(),
    staleTime: 5 * 60_000,
  });
}

export function useSections(
  typeId: number,
  isHomeScreen: number,
  ctx?: SessionContext,
  opts?: { initialData?: ApiListResponse<Section[]> },
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.sections(isHomeScreen, typeId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) =>
      catalogApi.sectionList(payload.sectionList(
        ctx ?? { userId: 0, deviceId: 'web' },
        typeId, isHomeScreen, pageParam as number,
      )),
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) =>
      last.more_page ? (lastPage as number) + 1 : undefined,
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
    initialData: opts?.initialData
      ? { pages: [opts.initialData], pageParams: [1] }
      : undefined,
  });
}

export function useSectionDetail(sectionId: number, ctx?: SessionContext) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.sectionDetail(sectionId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) =>
      catalogApi.sectionDetail({
        section_id: sectionId,
        user_id: ctx?.userId ?? 0,
        device_id: ctx?.deviceId ?? 'web',
        page_no: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) =>
      last.more_page ? (lastPage as number) + 1 : undefined,
    enabled: sectionId > 0,
  });
}

export function useContentDetail(
  videoType: number, typeId: number, videoId: number,
  subVideoType = 0, ctx?: SessionContext,
) {
  return useQuery({
    queryKey: [...queryKeys.contentDetail(videoType, typeId, videoId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: () => catalogApi.contentDetail(
      payload.contentDetail(
        ctx ?? { userId: 0, deviceId: 'web' },
        typeId, videoType, videoId, subVideoType,
      ),
    ),
    enabled: videoId > 0,
  });
}

export function useRelatedContent(
  videoType: number, typeId: number, videoId: number,
  subVideoType = 0, pageNo = 1,
) {
  return useQuery({
    queryKey: queryKeys.related(videoId, pageNo),
    queryFn: () => catalogApi.relatedContent({
      type_id: typeId, video_type: videoType,
      video_id: videoId, sub_video_type: subVideoType, page_no: pageNo,
    }),
    enabled: videoId > 0,
  });
}

export function useEpisodes(seasonId: number, ctx?: SessionContext, showId?: number) {
  return useQuery({
    queryKey: queryKeys.episodes(seasonId, showId),
    queryFn: () => catalogApi.getVideoBySeasonId({
      show_id: showId ?? 0,
      season_id: seasonId,
      user_id: ctx?.userId ?? 0,
    }),
    enabled: seasonId > 0 && (showId ?? 0) > 0,
  });
}

export function useCastDetail(castId: number) {
  return useQuery({
    queryKey: queryKeys.cast(castId),
    queryFn: () => catalogApi.castDetail({ cast_id: castId }),
    enabled: castId > 0,
  });
}

export function useCategories(opts?: { initialData?: ApiListResponse<Category[]> }) {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => catalogApi.getCategory(),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    initialData: opts?.initialData,
  });
}

export function useLanguages() {
  return useQuery({
    queryKey: queryKeys.languages,
    queryFn: () => catalogApi.getLanguage(),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

export function useChannels() {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => catalogApi.getChannel(),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

export function useContentTypes(ctx?: SessionContext) {
  return useQuery({
    queryKey: queryKeys.types,
    queryFn: () => catalogApi.getType(ctx),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

export function useSearch(name: string, pageNo = 1, ctx?: SessionContext) {
  return useQuery({
    queryKey: [...queryKeys.search(name, pageNo), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: () => catalogApi.searchContent(
      payload.search(ctx ?? { userId: 0, deviceId: 'web' }, name, pageNo),
    ),
    enabled: name.length >= 1,
  });
}

export function useLatestCatalog(
  pageNo = 1,
  ctx?: SessionContext,
  opts?: { initialData?: ApiListResponse<ContentItem[]> },
) {
  return useQuery({
    queryKey: [...queryKeys.search('', pageNo), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: () => catalogApi.searchContent(
      payload.search(ctx ?? { userId: 0, deviceId: 'web' }, '', pageNo),
    ),
    staleTime: 2 * 60_000,
    initialData: opts?.initialData,
  });
}

export function useShortsList(pageNo = 1, ctx?: SessionContext) {
  return useQuery({
    queryKey: [...queryKeys.shorts(pageNo), ctx?.userId ?? 0],
    queryFn: () => catalogApi.getShortsList({
      page_no: pageNo,
      user_id: ctx?.userId ?? 0,
    }),
  });
}

export function useShortsEpisodes(shortsId: number, seasonId?: number, ctx?: SessionContext) {
  return useQuery({
    queryKey: [...queryKeys.shortsEpisodes(shortsId, seasonId), ctx?.userId ?? 0],
    queryFn: () => catalogApi.getShortsEpisode({
      shorts_id: shortsId,
      season_id: seasonId,
      user_id: ctx?.userId ?? 0,
    }),
    enabled: shortsId > 0,
  });
}

export function useContinueWatching(ctx?: SessionContext) {
  return useQuery({
    queryKey: [...queryKeys.continueWatching, ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: () => catalogApi.getContinueWatching({
      user_id: ctx?.userId ?? 0,
      device_id: ctx?.deviceId ?? 'web',
    }),
    enabled: !!ctx?.userId,
  });
}

export function useContentByCategory(categoryId: number, pageNo = 1, ctx?: SessionContext) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.byCategory(categoryId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) => catalogApi.contentByCategory({
      category_id: categoryId,
      user_id: ctx?.userId ?? 0,
      device_id: ctx?.deviceId ?? 'web',
      page_no: pageParam,
    }),
    initialPageParam: pageNo,
    getNextPageParam: (last, _all, lastPage) =>
      last.more_page ? (lastPage as number) + 1 : undefined,
    enabled: categoryId > 0,
  });
}

export function useContentByLanguage(language: string | number, pageNo = 1, ctx?: SessionContext) {
  const isString = typeof language === 'string';
  const raw = isString ? language.toLowerCase().trim() : '';
  const isAllExceptKannada = isString && (raw === 'all' || raw === '0' || raw === 'non-kannada' || raw === 'all-languages' || raw === 'all-indian' || raw === 'except-kannada');
  const numericId = typeof language === 'number' ? language : (!isNaN(Number(language)) ? Number(language) : 0);

  return useInfiniteQuery({
    queryKey: [...queryKeys.byLanguage(numericId), String(language), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) => {
      if (isAllExceptKannada) {
        return catalogApi.contentNonKannada();
      }
      if (isString && isNaN(Number(language))) {
        return catalogApi.contentByLanguage(language);
      }
      return catalogApi.contentByLanguage({
        language_id: numericId,
        user_id: ctx?.userId ?? 0,
        device_id: ctx?.deviceId ?? 'web',
        page_no: pageParam,
      });
    },
    initialPageParam: pageNo,
    getNextPageParam: (last, _all, lastPage) =>
      last?.more_page ? (lastPage as number) + 1 : undefined,
    enabled: isString ? !!language : numericId > 0,
  });
}

export function useContentNonKannada() {
  return useQuery({
    queryKey: ['catalog', 'content', 'non-kannada'],
    queryFn: () => catalogApi.contentNonKannada(),
  });
}

export function useContentByChannel(channelId: number, pageNo = 1, ctx?: SessionContext) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.byChannel(channelId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) => catalogApi.contentByChannel({
      channel_id: channelId,
      user_id: ctx?.userId ?? 0,
      device_id: ctx?.deviceId ?? 'web',
      page_no: pageParam,
    }),
    initialPageParam: pageNo,
    getNextPageParam: (last, _all, lastPage) =>
      last.more_page ? (lastPage as number) + 1 : undefined,
    enabled: channelId > 0,
  });
}

export function useContentByCast(castId: number, pageNo = 1, ctx?: SessionContext) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.byCast(castId), ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) => catalogApi.contentByCast({
      cast_id: castId,
      user_id: ctx?.userId ?? 0,
      device_id: ctx?.deviceId ?? 'web',
      page_no: pageParam,
    }),
    initialPageParam: pageNo,
    getNextPageParam: (last, _all, lastPage) =>
      last.more_page ? (lastPage as number) + 1 : undefined,
    enabled: castId > 0,
  });
}

export function useRentContent(pageNo = 1, ctx?: SessionContext) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.rentContent, ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: ({ pageParam = 1 }) => catalogApi.rentContentList({
      user_id: ctx?.userId ?? 0,
      device_id: ctx?.deviceId ?? 'web',
      page_no: pageParam,
    }),
    initialPageParam: pageNo,
    getNextPageParam: (last, _all, lastPage) =>
      last.more_page ? (lastPage as number) + 1 : undefined,
  });
}

export function useUserRentContent(userId: number | string) {
  return useQuery({
    queryKey: queryKeys.userRentContent(userId),
    queryFn: () => catalogApi.userRentContentList({ user_id: userId }),
    enabled: !!userId,
  });
}

export function useBookmarks(ctx?: SessionContext) {
  return useQuery({
    queryKey: [...queryKeys.bookmarks, ctx?.userId ?? 0, ctx?.deviceId ?? 'web'],
    queryFn: () => catalogApi.getBookmarkVideo({
      user_id: ctx?.userId ?? 0,
      device_id: ctx?.deviceId ?? 'web',
    }),
    enabled: !!ctx?.userId,
  });
}

export function useNotifications(ctx?: SessionContext) {
  return useQuery({
    queryKey: [...queryKeys.notifications, ctx?.userId ?? 0],
    queryFn: () => catalogApi.getNotification({ user_id: ctx?.userId ?? 0 }),
    enabled: !!ctx?.userId,
  });
}

export function useOnboarding() {
  return useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: () => catalogApi.getOnboardingScreen(),
    staleTime: 30 * 60_000,
  });
}

export function usePages() {
  return useQuery({
    queryKey: queryKeys.pages,
    queryFn: () => catalogApi.getPages(),
    staleTime: 10 * 60_000,
  });
}

export function useSocialLinks() {
  return useQuery({
    queryKey: queryKeys.socialLinks,
    queryFn: () => catalogApi.getSocialLink(),
    staleTime: 10 * 60_000,
  });
}

export function useAvatars() {
  return useQuery({
    queryKey: queryKeys.avatars,
    queryFn: () => catalogApi.getAvatar(),
    staleTime: 30 * 60_000,
  });
}
