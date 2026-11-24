import { getJson, postJson, putJson, deleteJson } from './client';
import { OttApiError } from './errors';
import type {
  ApiListResponse,
  Avatar,
  Banner,
  CastMember,
  Category,
  Channel,
  Comment,
  ContentItem,
  ContentRecord,
  ContentType,
  Coupon,
  DeviceSync,
  Episode,
  GeneralSettingRow,
  IntroVideo,
  Language,
  LoginUserResult,
  Notification,
  OnboardingScreen,
  PageItem,
  PortalBanner,
  RazorpayOrderResult,
  RentTransaction,
  ReferEarn,
  RentItem,
  Section,
  ShortsEpisode,
  ShortsItem,
  SocialLink,
  SubscriptionPackage,
  Transaction,
  TVLoginCode,
} from '../types/models';

type Json = Record<string, unknown>;

type AuthAcceptedEnvelope = {
  success: boolean;
  data: { accepted: boolean };
  meta: Record<string, unknown>;
};

export interface SessionContext {
  userId: number | string;
  deviceId: string;
  isKidsProfile?: boolean;
}

function kidsFlag(ctx?: SessionContext): number {
  return ctx?.isKidsProfile ? 1 : 0;
}

function uid(ctx?: SessionContext): number | string {
  return ctx?.userId ?? 0;
}

function did(ctx?: SessionContext): string {
  return ctx?.deviceId ?? 'web';
}

// ──────────────────── Auth ────────────────────

export const authApi = {
  requestRegistrationOtp: (
    phone: string,
    agentCode?: string,
    recaptchaToken?: string | null,
  ): Promise<AuthAcceptedEnvelope> =>
    postJson('auth/send-otp', {
      phone,
      mode: 'register',
      isRegister: true,
      agentCode: agentCode?.trim().toUpperCase() || undefined,
      recaptchaToken: recaptchaToken || undefined,
    }),

  requestPhoneLoginOtp: (
    phone: string,
    recaptchaToken?: string | null,
  ): Promise<AuthAcceptedEnvelope> =>
    postJson('auth/send-otp', {
      phone,
      mode: 'login',
      recaptchaToken: recaptchaToken || undefined,
    }),

  phoneOtpLogin: async (phone: string, code: string): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/verify-otp', { phone, otp: code }),

  register: async (body: Json): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/register', body),

  login: async (body: Json): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/login', body),

  getProfile: (_body?: Json): Promise<ApiListResponse<LoginUserResult[]>> =>
    getJson('auth/profile'),

  updateProfile: (body: Json | FormData): Promise<ApiListResponse<LoginUserResult[]>> =>
    putJson('auth/profile', body),

  getDeviceSyncList: (_body?: Json): Promise<ApiListResponse<DeviceSync[]>> =>
    getJson('devices'),

  sendEmailOtp: (body: Json): Promise<ApiListResponse<unknown[]>> =>
    postJson('auth/send-otp', body),

  verifyEmailOtp: (body: Json): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/verify-otp', body),

  firebasePhoneLogin: (body: Json): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/verify-otp', body),

  getTvLoginCode: (): Promise<ApiListResponse<TVLoginCode[]>> =>
    getJson('auth/tv-code'),

  tvLogin: (body: Json): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/tv-login', body),

  checkTvLogin: (body: Json): Promise<ApiListResponse<TVLoginCode[]>> =>
    postJson('auth/tv-check', body),

  parentControlCheckPassword: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    postJson('auth/verify-pin', body),

  addRemoveKidsMode: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    putJson('auth/profile', body),

  generateWebToken: (): Promise<ApiListResponse<{ web_token: string }[]>> =>
    postJson('auth/refresh', {}),

  consumeWebToken: (webToken: string): Promise<ApiListResponse<LoginUserResult[]>> =>
    postJson('auth/refresh', { refreshToken: webToken }),
};

// ──────────────────── Catalog ────────────────────

export const catalogApi = {
  generalSetting: (): Promise<ApiListResponse<GeneralSettingRow[]>> =>
    getJson('settings'),

  getOnboardingScreen: (): Promise<ApiListResponse<OnboardingScreen[]>> =>
    getJson('settings'),

  getPages: (): Promise<ApiListResponse<PageItem[]>> =>
    getJson('legal'),

  getSocialLink: (): Promise<ApiListResponse<SocialLink[]>> =>
    getJson('settings'),

  getAvatar: (): Promise<ApiListResponse<Avatar[]>> =>
    getJson('profiles'),

  getType: (_ctx?: SessionContext): Promise<ApiListResponse<ContentType[]>> =>
    getJson('content-types'),

  getBanner: (_body?: Json): Promise<ApiListResponse<Banner[]>> =>
    getJson('cms/banners', { params: { platform: 'WEB' } }),

  getPortalBanners: (portalKey?: string): Promise<ApiListResponse<PortalBanner[]>> =>
    getJson('cms/portal-banners', portalKey ? { params: { portalKey } } : undefined),

  getIntroVideo: (): Promise<ApiListResponse<IntroVideo | null>> =>
    getJson('cms/intro-video/active'),

  sectionList: (_body?: Json): Promise<ApiListResponse<Section[]>> =>
    getJson('cms/sections'),

  sectionDetail: (body?: Json): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('catalog', { params: body as any }),

  contentDetail: (body: Json): Promise<ApiListResponse<ContentItem[]>> => {
    const id = body?.contentId ?? body?.id ?? body?.video_id ?? body?.slug ?? '';
    return getJson(`catalog/${encodeURIComponent(String(id))}`);
  },

  relatedContent: (_body?: Json): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('content/trending'),

  getRelatedContent: (_body?: Json): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('content/trending'),

  getShortsList: (_body?: Json): Promise<ApiListResponse<ShortsItem[]>> =>
    getJson('content/shorts'),

  getShortsEpisode: (_body?: Json): Promise<ApiListResponse<ShortsEpisode[]>> =>
    getJson('content/shorts'),

  getContinueWatching: (_body?: Json): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('watch/continue-watching'),

  getVideoBySeasonId: (body: Json): Promise<ApiListResponse<Episode[]>> => {
    const seasonId = body?.seasonId ?? body?.season_id ?? body?.id ?? 1;
    return getJson(`catalog/seasons/${encodeURIComponent(String(seasonId))}/episodes`);
  },

  castDetail: (_body?: Json): Promise<ApiListResponse<CastMember[]>> =>
    getJson('cast'),

  getCategory: (_body?: Json): Promise<ApiListResponse<Category[]>> =>
    getJson('categories'),

  getLanguage: (_body?: Json): Promise<ApiListResponse<Language[]>> =>
    getJson('languages'),

  getChannel: (_body?: Json): Promise<ApiListResponse<Channel[]>> =>
    getJson('live/channels'),

  searchContent: (body?: Json): Promise<ApiListResponse<ContentItem[]>> => {
    const q = String(body?.q ?? body?.query ?? body?.name ?? '').trim();
    return getJson('search', { params: { q, size: 60 } });
  },

  rentContentList: (_body?: Json): Promise<ApiListResponse<RentItem[]>> =>
    getJson('tvod/products'),

  userRentContentList: (_body?: Json): Promise<ApiListResponse<RentItem[]>> =>
    getJson('tvod/purchases'),

  contentByCategory: (body: Json): Promise<ApiListResponse<ContentItem[]>> => {
    const catId = body?.categoryId ?? body?.category_id ?? body?.genre ?? body?.id ?? '';
    return getJson(`categories/${encodeURIComponent(String(catId))}/content`);
  },

  contentByLanguage: (bodyOrLang: Json | string | number): Promise<ApiListResponse<ContentItem[]>> => {
    const lang =
      typeof bodyOrLang === 'string' || typeof bodyOrLang === 'number'
        ? bodyOrLang
        : (bodyOrLang?.language ?? bodyOrLang?.language_id ?? 'kn');
    return getJson(`content/by-language/${encodeURIComponent(String(lang))}`);
  },

  contentNonKannada: (): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('content/non-kannada'),

  contentByChannel: (_body?: Json): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('catalog'),

  contentByCast: (body?: Json): Promise<ApiListResponse<ContentItem[]>> =>
    getJson('catalog', { params: body as any }),

  getBookmarkVideo: async (_body?: Json): Promise<ApiListResponse<ContentItem[]>> => {
    try {
      return await getJson('watchlist');
    } catch (err) {
      if (err instanceof OttApiError && (err.status === 400 || err.status === 401)) {
        return {
          status: 200,
          message: 'No watchlist items found.',
          result: [],
        };
      }
      throw err;
    }
  },

  getDownloadUrl: (body: { video_id: number; user_id: number }): Promise<ApiListResponse<{ url: string; expires_at: string }[]>> =>
    getJson(`playback/authorize/${body.video_id}`),

  getNotification: (_body?: Json): Promise<ApiListResponse<Notification[]>> =>
    getJson('notifications'),

  readNotification: (body: Json): Promise<ApiListResponse<ContentRecord[]>> => {
    const id = body?.id ?? body?.notificationId ?? body?.notification_id ?? 0;
    return postJson(`notifications/${id}/read`, {});
  },

  getReferEarnHistory: (_body?: Json): Promise<ApiListResponse<ReferEarn[]>> =>
    getJson('payments/my-transactions'),

  getCouponList: (_body?: Json): Promise<ApiListResponse<Coupon[]>> =>
    getJson('plans'),
};

// ──────────────────── Engagement ────────────────────

export const engagementApi = {
  getComment: (_body?: Json): Promise<ApiListResponse<Comment[]>> =>
    Promise.resolve({ status: 200, message: 'Success', result: [] }),

  getReplyComment: (_body?: Json): Promise<ApiListResponse<Comment[]>> =>
    Promise.resolve({ status: 200, message: 'Success', result: [] }),

  addComment: (body: Json): Promise<ApiListResponse<Comment[]>> =>
    postJson('analytics/event', {
      ...body,
      contentId: body?.contentId ?? body?.content_id ?? body?.video_id,
      eventType: 'COMMENT',
      interactionType: 'COMMENT',
    }),

  editComment: (body: Json): Promise<ApiListResponse<Comment[]>> =>
    postJson('analytics/event', {
      ...body,
      contentId: body?.contentId ?? body?.content_id ?? body?.video_id,
      eventType: 'COMMENT_EDIT',
      interactionType: 'COMMENT',
    }),

  deleteComment: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    postJson('analytics/event', {
      ...body,
      contentId: body?.contentId ?? body?.content_id ?? body?.video_id,
      eventType: 'COMMENT_DELETE',
      interactionType: 'COMMENT',
    }),

  addVideoView: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    postJson('analytics/event', {
      ...body,
      contentId: body?.contentId ?? body?.content_id ?? body?.video_id,
      eventType: 'CONTENT_VIEW',
      interactionType: 'VIEW',
    }),

  addRemoveBookmark: (body: Json): Promise<ApiListResponse<ContentRecord[]>> => {
    const contentId = body?.contentId ?? body?.content_id ?? body?.video_id ?? body?.id;
    if (body?.action === 'remove' && contentId) {
      return deleteJson(`watchlist/${contentId}`);
    }
    return postJson('watchlist', { contentId });
  },

  addRemoveLike: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    postJson('analytics/event', {
      ...body,
      contentId: body?.contentId ?? body?.content_id ?? body?.video_id,
      eventType: 'CONTENT_LIKE',
      interactionType: 'LIKE',
    }),

  addContinueWatching: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    postJson('watch/progress', {
      contentId: body?.contentId ?? body?.video_id,
      episodeId: body?.episodeId ?? body?.episode_id,
      // `stop_time` / `video_duration` arrive in seconds; do not rescale them.
      watchedDurationSeconds:
        body?.watchedDurationSeconds ?? body?.positionSeconds ?? body?.stop_time ?? 0,
      totalDurationSeconds:
        body?.totalDurationSeconds ?? body?.durationSeconds ?? body?.video_duration ?? 0,
    }),

  removeContinueWatching: (body: Json): Promise<ApiListResponse<ContentRecord[]>> => {
    const id = body?.contentId ?? body?.video_id ?? body?.id ?? 0;
    return deleteJson(`watch/history/${id}`);
  },
};

// ──────────────────── Payment ────────────────────

export const paymentApi = {
  getPackage: async (_body?: Json): Promise<ApiListResponse<SubscriptionPackage[]>> => {
    const response = await getJson<ApiListResponse<SubscriptionPackage[]>>('plans');
    return normalizePackageResponse(response);
  },

  applyCoupon: (body: Json): Promise<ApiListResponse<ContentRecord[]>> =>
    postJson('plans/validate-coupon', body),

  createRazorpayOrder: (body: Json): Promise<ApiListResponse<RazorpayOrderResult[]>> =>
    postJson('payments/create-order', body),

  verifyRazorpayPayment: (body: Json): Promise<ApiListResponse<Transaction[]>> =>
    postJson('payments/verify', body),

  addTransaction: (body: Json): Promise<ApiListResponse<Transaction[]>> =>
    postJson('payments/verify', body),

  addRentTransaction: (body: Json): Promise<ApiListResponse<RentTransaction[]>> =>
    postJson('tvod/purchase', body),

  getTransactionList: (_body?: Json): Promise<ApiListResponse<Transaction[]>> =>
    getJson('payments/my-transactions'),

  validateCouponV1: async (
    code: string,
    amount: number,
    planId?: number | string,
  ): Promise<{ success: boolean; data: number; message: string }> => {
    const qs = new URLSearchParams({
      code: code.trim().toUpperCase(),
      amount: String(amount),
    });
    if (planId != null && String(planId).trim() !== '') {
      qs.set('planId', String(planId));
    }
    const res = await fetch(`/api/v1/coupons/validate?${qs.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: number | { discountAmount?: number; discount_amount?: number };
      result?: number | { discountAmount?: number; discount_amount?: number };
      message?: string;
    };
    const payload = json.data ?? json.result;
    const discountAmount =
      typeof payload === 'number'
        ? payload
        : Number(payload?.discountAmount ?? payload?.discount_amount ?? NaN);
    if (!res.ok || !json.success || !Number.isFinite(discountAmount)) {
      throw new Error(json.message ?? 'Invalid coupon code');
    }
    return {
      success: true,
      data: discountAmount,
      message: json.message ?? 'Coupon applied',
    };
  },
};

function normalizePackageResponse(
  response: ApiListResponse<SubscriptionPackage[]>,
): ApiListResponse<SubscriptionPackage[]> {
  return {
    ...response,
    result: (response.result ?? []).map((pkg) => ({
      ...pkg,
      price: Number(pkg.price ?? 0),
      time: pkg.time !== undefined ? Number(pkg.time) : (pkg as any).durationDays,
      currency_code: pkg.currency_code ?? '₹',
      data: (pkg.data ?? []).map((detail) => ({
        ...detail,
        title:
          detail.title ??
          String(detail.package_value ?? detail.package_key ?? '').trim(),
      })),
    })),
  };
}

// ──────────────────── Payload builders ────────────────────

export const payload = {
  sectionList: (
    ctx: SessionContext,
    typeId: number,
    isHomeScreen: number,
    pageNo: number,
  ) => ({
    userId: uid(ctx),
    typeId,
    isHomeScreen,
    deviceId: did(ctx),
    isKidsProfile: kidsFlag(ctx),
    page: pageNo,
  }),

  contentDetail: (
    ctx: SessionContext,
    typeId: number,
    videoType: number,
    videoId: number,
    subVideoType: number,
  ) => ({
    userId: uid(ctx),
    typeId,
    videoType,
    contentId: videoId,
    subVideoType,
    deviceId: did(ctx),
    isKidsProfile: kidsFlag(ctx),
  }),

  search: (
    ctx: SessionContext,
    name: string,
    pageNo: number,
  ) => ({
    q: name,
    userId: uid(ctx),
    deviceId: did(ctx),
    isKidsProfile: kidsFlag(ctx),
    page: pageNo,
  }),

  banner: (isHomeScreen: number, typeId: number, ctx?: SessionContext) => ({
    isHomeScreen,
    typeId,
    userId: uid(ctx),
    deviceId: did(ctx),
    isKidsProfile: kidsFlag(ctx),
  }),
};
