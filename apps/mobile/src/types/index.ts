import { AppConfig } from '../core/config';

export interface User {
  id?: number;
  fullName?: string;
  userName?: string;
  email?: string;
  mobileNumber?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  dob?: string;
  profession?: string;
  pincode?: string;
  image?: string;
  isBuy?: number;
  packageName?: string;
  expiryDate?: string;
  walletAmount?: any;
  referenceCode?: string;
  createdAt?: string;
  authToken?: string;
}

export function parseUser(json: any): User {
  let pkgName: string | undefined;
  if (json.package_name) {
    pkgName = String(json.package_name);
  } else if (json.packageName) {
    pkgName = String(json.packageName);
  } else if (json.package_title) {
    pkgName = String(json.package_title);
  } else if (json.packageTitle) {
    pkgName = String(json.packageTitle);
  } else if (json.plan_name) {
    pkgName = String(json.plan_name);
  } else if (json.planName) {
    pkgName = String(json.planName);
  } else if (json.subscription?.planName) {
    pkgName = String(json.subscription.planName);
  } else if (json.subscription?.plan?.name) {
    pkgName = String(json.subscription.plan.name);
  } else if (json.current_package) {
    pkgName = String(json.current_package);
  } else if (json.package) {
    if (typeof json.package === 'string' && json.package) {
      pkgName = json.package;
    } else if (typeof json.package === 'object' && json.package.name) {
      pkgName = String(json.package.name);
    }
  }

  let isBuyVal: number | undefined;
  const rawIsBuy =
    json.isBuy ??
    json.is_buy ??
    json.is_buy_package ??
    json.isSubscribed ??
    json.is_subscribed ??
    json.subscribed ??
    (json.subscription?.status === 'ACTIVE' ? 1 : undefined);

  if (rawIsBuy !== undefined && rawIsBuy !== null) {
    if (typeof rawIsBuy === 'boolean') {
      isBuyVal = rawIsBuy ? 1 : 0;
    } else if (typeof rawIsBuy === 'number') {
      isBuyVal = rawIsBuy;
    } else if (typeof rawIsBuy === 'string') {
      isBuyVal = parseInt(rawIsBuy, 10) || (rawIsBuy.toLowerCase() === 'true' ? 1 : 0);
    }
  }

  const expDate =
    json.expiryDate ??
    json.expiry_date ??
    json.expire_date ??
    json.end_date ??
    json.endDate ??
    json.subscription?.endDate ??
    json.subscription?.end_date ??
    json.package_expiry_date ??
    json.exp_date ??
    json.user_expiry_date;

  const dob = json.date_of_birth || json.dateOfBirth || json.dob || undefined;
  const prof = json.profession || undefined;
  const pincodeVal = json.pincode || json.pin_code || json.postal_code || undefined;

  return {
    id: json.id ? parseInt(String(json.id), 10) : undefined,
    fullName: json.full_name || json.fullName || json.name || undefined,
    userName: json.user_name || undefined,
    email: json.email || undefined,
    mobileNumber: json.mobile_number || json.mobile || json.phoneNumber || json.phone_number || undefined,
    phoneNumber: json.phoneNumber || json.phone_number || json.mobile_number || json.mobile || undefined,
    dateOfBirth: dob,
    dob: dob,
    profession: prof,
    pincode: pincodeVal,
    image: AppConfig.normalizeMediaUrl(json.image || json.avatarUrl || json.avatar_url),
    isBuy: isBuyVal !== undefined ? isBuyVal : 0,
    packageName: pkgName,
    expiryDate: expDate ? String(expDate) : undefined,
    walletAmount: json.wallet_amount,
    referenceCode: json.reference_code || json.referenceCode || undefined,
    createdAt: json.created_at || json.createdAt || undefined,
    authToken: json.auth_token || json.authToken || json.token || undefined,
  };
}

export interface CatalogCastMember {
  id?: number;
  name?: string;
  image?: string;
  type?: string;
  personalInfo?: string;
}

export interface CatalogItem {
  id: number | string;
  slug?: string;
  typeId: number;
  videoType: number;
  subVideoType?: number;
  name: string;
  thumbnail?: string;
  landscape?: string;
  image?: string;
  description?: string;
  releaseDate?: string;
  releaseYear?: string;
  maturityRating?: string;
  language?: string;
  originalLanguageCode?: string;
  languageName?: string;
  languageId?: number;
  language_id?: number;
  genres?: string[];
  logoImage?: string;
  categoryName?: any;
  videoDuration?: number;
  stopTime?: number;
  percentage?: number;
  isPremium?: number;
  isRent?: number;
  is_rent?: number;
  isRented?: number;
  is_rented?: number;
  rentPrice?: number;
  rentDay?: number;
  rentBuy?: number;
  rentExpiryDate?: string;
  monetization?: string;
  cast?: CatalogCastMember[];
  videoUrl?: string;
  streamUrl?: string;
  masterPlaylistUrl?: string;
  videoAssetId?: string;
  video320Url?: string;
  video480Url?: string;
  video720Url?: string;
  video1080Url?: string;
  video2kUrl?: string;
  video4kUrl?: string;
  trailerUrl?: string;
}

export function parseCatalogItem(json: any): CatalogItem {
  let castList: CatalogCastMember[] | undefined;
  if (Array.isArray(json.cast)) {
    castList = json.cast.map((c: any) => ({
      id: c.id ? parseInt(String(c.id), 10) : undefined,
      name: c.name,
      image: AppConfig.normalizeMediaUrl(c.image || c.imageUrl || c.image_url, c.updatedAt || c.updated_at),
      type: c.type,
      personalInfo: c.personal_info || c.personalInfo,
    }));
  }

  const rawThumb =
    json.thumbnail ||
    json.posterUrl ||
    json.poster_url ||
    json.poster ||
    json.image ||
    json.imageUrl ||
    json.image_url;
  const rawLand =
    json.landscape ||
    json.backdropUrl ||
    json.backdrop_url ||
    json.landscapeUrl ||
    json.landscape_url ||
    json.landscapeImageUrl ||
    json.landscape_image_url ||
    json.bannerUrl ||
    json.banner_url ||
    json.banner;
  const rawImg =
    json.image ||
    json.imageUrl ||
    json.image_url ||
    json.posterUrl ||
    json.poster_url ||
    json.poster ||
    json.thumbnail;
  const versionKey = json.updatedAt || json.updated_at || json.version;

  const rawStream =
    json.streamUrl ||
    json.stream_url ||
    json.videoUrl ||
    json.video_url ||
    json.movie?.videoAssetId ||
    json.movie?.video_asset_id ||
    json.movie?.videoUrl ||
    json.movie?.video_url ||
    json.movie?.streamUrl ||
    json.movie?.stream_url ||
    json.movie?.masterPlaylistUrl ||
    json.movie?.master_playlist_url ||
    json.episodes?.[0]?.videoAssetId ||
    json.episodes?.[0]?.videoUrl ||
    json.episodes?.[0]?.streamUrl ||
    json.seasons?.[0]?.episodes?.[0]?.videoAssetId ||
    json.seasons?.[0]?.episodes?.[0]?.videoUrl ||
    json.video4kUrl ||
    json.video_4k_url ||
    json.video_4k ||
    json.video2kUrl ||
    json.video_2k_url ||
    json.video_2k ||
    json.video1080Url ||
    json.video_1080_url ||
    json.video_1080 ||
    json.video720Url ||
    json.video_720_url ||
    json.video_720 ||
    json.video480Url ||
    json.video_480_url ||
    json.video_480 ||
    json.video320Url ||
    json.video_320_url ||
    json.video320 ||
    json.masterPlaylistUrl ||
    json.master_playlist_url ||
    json.videoAssetId ||
    json.video_asset_id ||
    json.rawVideoUrl ||
    json.raw_video_url ||
    json.trailerUrl ||
    json.trailer_url;

  let parsedTypeId = parseInt(String(json.type_id || json.typeId || 0), 10);
  const ctUpper = String(json.contentType || json.content_type || json.type || '').toUpperCase().trim();
  if (ctUpper === 'MOVIE' || ctUpper === 'FILM') {
    parsedTypeId = 1;
  } else if (ctUpper === 'ALBUM' || ctUpper === 'SONG' || ctUpper === 'MUSIC' || ctUpper === 'MUSIC_VIDEO') {
    parsedTypeId = 2;
  } else if (ctUpper === 'SHORT_FILM' || ctUpper === 'SHORT' || ctUpper === 'SHORTS') {
    parsedTypeId = 3;
  } else if (ctUpper === 'MICRODRAMA' || ctUpper === 'MICRO_DRAMA') {
    parsedTypeId = 4;
  } else if (ctUpper === 'PODCAST' || ctUpper === 'PODCASTS') {
    parsedTypeId = 5;
  } else if (ctUpper === 'SERIES' || ctUpper === 'SHOW' || ctUpper === 'SHOWS') {
    parsedTypeId = 6;
  } else if (ctUpper.includes('AI') || ctUpper === 'AI_MOVIE' || ctUpper === 'AI_SERIES' || ctUpper === 'AI_MICRODRAMA' || ctUpper === 'AI_MICRO_DRAMA' || ctUpper === 'AI_GENERATED') {
    parsedTypeId = 7;
  } else if (!parsedTypeId || parsedTypeId === 0) {
    parsedTypeId = 1;
  }

  const rawId = json.id ?? json.video_id ?? json.videoId ?? json.content_id ?? json.contentId ?? json.resource_id ?? json.show_id;
  let parsedId: number | string = 0;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    parsedId = rawId;
  } else if (typeof rawId === 'string' && rawId.trim() !== '' && rawId !== 'NaN' && rawId !== 'undefined') {
    const n = Number(rawId);
    parsedId = Number.isFinite(n) && n > 0 && !rawId.includes('-') ? n : rawId.trim();
  }

  const rawVideoType = json.video_type ?? json.videoType;
  let parsedVideoType = typeof rawVideoType === 'number' && Number.isFinite(rawVideoType) ? rawVideoType : parseInt(String(rawVideoType ?? 1), 10);
  if (ctUpper === 'MOVIE' || ctUpper === 'FILM') {
    parsedVideoType = 1;
  } else if (parsedTypeId > 0) {
    parsedVideoType = parsedTypeId;
  }
  if (!Number.isFinite(parsedVideoType) || parsedVideoType <= 0) parsedVideoType = 1;

  const rawSlug = json.slug || (typeof rawId === 'string' && isNaN(Number(rawId)) ? rawId : undefined);

  return {
    id: parsedId,
    slug: rawSlug,
    typeId: parsedTypeId || 1,
    videoType: parsedVideoType,
    subVideoType: json.sub_video_type || json.subVideoType ? parseInt(String(json.sub_video_type || json.subVideoType), 10) : undefined,
    name: json.name || json.title || '',
    thumbnail: AppConfig.normalizeMediaUrl(rawThumb, versionKey),
    landscape: AppConfig.normalizeMediaUrl(rawLand, versionKey),
    image: AppConfig.normalizeMediaUrl(rawImg, versionKey),
    description: json.description || json.synopsis || json.shortDescription,
    releaseDate: json.release_date || json.releaseDate || (json.releaseYear ? String(json.releaseYear) : undefined),
    releaseYear: String(json.release_year || json.releaseYear || '').trim() || undefined,
    maturityRating: json.maturity_rating || json.age_rating || json.ageRating,
    language: typeof json.language === 'string' ? json.language : (json.language?.name || json.language_name || json.original_language_code || json.originalLanguageCode),
    originalLanguageCode: json.originalLanguageCode || json.original_language_code || (typeof json.language === 'object' ? json.language?.code : undefined),
    languageName: json.language_name || json.languageName || (typeof json.language === 'object' ? json.language?.name : (typeof json.language === 'string' ? json.language : undefined)),
    languageId: json.language_id || json.languageId || (typeof json.language === 'object' ? json.language?.id : undefined) ? parseInt(String(json.language_id || json.languageId || json.language?.id), 10) : undefined,
    language_id: json.language_id || json.languageId || (typeof json.language === 'object' ? json.language?.id : undefined) ? parseInt(String(json.language_id || json.languageId || json.language?.id), 10) : undefined,
    genres: Array.isArray(json.genres) ? json.genres.map((genre: any) => typeof genre === 'string' ? genre : genre.name).filter(Boolean) : [],
    logoImage: AppConfig.normalizeMediaUrl(json.logo_image || json.logoImageUrl),
    categoryName: json.category_name || json.categoryName || json.category?.name,
    videoDuration: json.duration_seconds || json.durationSeconds || json.video_duration ? parseInt(String(json.duration_seconds || json.durationSeconds || json.video_duration), 10) : undefined,
    stopTime: json.stop_time || json.stopTime || json.position_seconds || json.positionSeconds ? parseInt(String(json.stop_time || json.stopTime || json.position_seconds || json.positionSeconds), 10) : undefined,
    percentage: json.percentage !== undefined && json.percentage !== null ? parseFloat(String(json.percentage)) : undefined,
    isPremium: json.is_premium || json.isPremium || json.premium ? 1 : 0,
    isRent: (json.is_rent || json.isRent || (json.monetization && String(json.monetization).toUpperCase() === 'TVOD')) ? 1 : 0,
    is_rent: (json.is_rent || json.isRent || (json.monetization && String(json.monetization).toUpperCase() === 'TVOD')) ? 1 : 0,
    isRented: (json.is_rented === 1 || json.isRented === 1 || json.rent_buy === 1 || json.rentBuy === 1) ? 1 : 0,
    is_rented: (json.is_rented === 1 || json.isRented === 1 || json.rent_buy === 1 || json.rentBuy === 1) ? 1 : 0,
    rentBuy: (json.is_rented === 1 || json.isRented === 1 || json.rent_buy === 1 || json.rentBuy === 1) ? 1 : 0,
    rentExpiryDate: json.rent_expiry_date || json.rentExpiryDate ? String(json.rent_expiry_date || json.rentExpiryDate) : undefined,
    monetization: json.monetization || (json.is_rent || json.isRent ? 'TVOD' : (json.is_premium || json.isPremium ? 'SVOD' : 'AVOD')),
    rentPrice: (json.is_rent === 1 || json.isRent === 1 || (json.monetization && String(json.monetization).toUpperCase() === 'TVOD'))
      ? (json.rent_price !== undefined ? parseFloat(String(json.rent_price)) : (json.price !== undefined ? parseFloat(String(json.price)) : undefined))
      : undefined,
    rentDay: (json.is_rent === 1 || json.isRent === 1 || (json.monetization && String(json.monetization).toUpperCase() === 'TVOD'))
      ? (json.rent_day || json.rentDay ? parseInt(String(json.rent_day || json.rentDay), 10) : undefined)
      : undefined,
    cast: castList,
    videoUrl: rawStream ? AppConfig.normalizeMediaUrl(rawStream) : undefined,
    streamUrl: rawStream ? AppConfig.normalizeMediaUrl(rawStream) : undefined,
    masterPlaylistUrl: json.masterPlaylistUrl || json.master_playlist_url,
    videoAssetId: json.videoAssetId || json.video_asset_id || json.movie?.videoAssetId || json.movie?.video_asset_id,
    video320Url: json.video320Url || json.video_320_url,
    video480Url: json.video480Url || json.video_480_url,
    video720Url: json.video720Url || json.video_720_url,
    video1080Url: json.video1080Url || json.video_1080_url,
    video2kUrl: json.video2kUrl || json.video_2k_url,
    video4kUrl: json.video4kUrl || json.video_4k_url,
    trailerUrl: json.trailerUrl || json.trailer_url,
  };
}

export function getPosterUrl(item: CatalogItem): string {
  if (!item) return '';
  const raw =
    item.thumbnail ||
    (item as any).posterUrl ||
    (item as any).poster_url ||
    (item as any).poster ||
    item.image ||
    (item as any).imageUrl ||
    (item as any).image_url ||
    item.landscape ||
    (item as any).landscapeImageUrl ||
    (item as any).backdropUrl;
  return AppConfig.normalizeMediaUrl(raw) || '';
}

export function getBackgroundUrl(item: CatalogItem): string {
  if (!item) return '';
  const raw =
    item.landscape ||
    (item as any).landscapeImageUrl ||
    (item as any).landscape_image_url ||
    (item as any).backdropUrl ||
    (item as any).backdrop_url ||
    (item as any).bannerUrl ||
    (item as any).banner_url ||
    (item as any).banner ||
    item.thumbnail ||
    (item as any).posterUrl ||
    (item as any).poster ||
    item.image;
  return AppConfig.normalizeMediaUrl(raw) || '';
}

export interface CatalogContentType {
  id: number;
  name: string;
}

export interface CatalogCategory {
  id: number;
  typeId: number;
  name: string;
  image?: string;
}

export interface CatalogLanguage {
  id: number;
  name: string;
  code?: string;
  image?: string;
}

export interface HomeSection {
  landscape?: boolean;
  id: number;
  videoType: number;
  title: string;
  data: CatalogItem[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  priceInPaise: number;
  currency: string;
  billingCycle: string;
  maxScreens: number;
  maxResolution: string;
  offlineDownloads: boolean;
  autopayEnabled: boolean;
  isAutopayEligible: boolean;
  razorpayPlanId?: string;
  isActive: boolean;
  sortOrder: number;
}

export function parseSubscriptionPlan(json: any): SubscriptionPlan {
  const calculatedPaise = json.price_in_paise != null ? Math.round(Number(json.price_in_paise)) : Math.round(Number(json.price || 0) * 100);

  let nameVal = json.name || json.title || json.package_title || 'VIP Membership';

  let desc = json.description as string | undefined;
  if ((!desc || desc.length === 0) && Array.isArray(json.data)) {
    const features = json.data
      .map((e: any) => (typeof e === 'object' && e ? (e.package_title || e.title || e.name || '') : ''))
      .filter((s: string) => s.length > 0)
      .join(' • ');
    if (features) desc = features;
  }

  const isAutopay = Boolean(
    json.isAutopayEligible === true ||
    json.is_autopay_eligible === true ||
    json.autopayEnabled === true ||
    json.autopay_enabled === true ||
    json.isAutopay === true ||
    json.is_autopay === true ||
    json.autopay === true ||
    json.is_autopay_eligible === 1 ||
    json.autopay_enabled === 1 ||
    json.is_autopay === 1
  );

  return {
    id: String(json.id ?? ''),
    name: String(nameVal),
    description: desc,
    priceInPaise: Number.isFinite(calculatedPaise) ? calculatedPaise : 0,
    currency: json.currency ? String(json.currency) : 'INR',
    billingCycle: String(
      json.billing_period ||
      json.billingPeriod ||
      json.billing_cycle ||
      json.billingCycle ||
      (json.time && (json.type || json.time_type) ? `${json.time} ${json.type || json.time_type}` : '') ||
      json.type ||
      json.time_type ||
      (json.time ? `${json.time} month` : '') ||
      'MONTHLY'
    ),
    maxScreens: Number(json.maxConcurrentStreams || json.maxDevices || json.max_screens || 1),
    maxResolution: String(json.maxResolution || json.max_resolution || ''),
    offlineDownloads: json.downloadsEnabled === true || json.offline_downloads === true || json.offline_downloads === 1,
    autopayEnabled: isAutopay,
    isAutopayEligible: isAutopay,
    razorpayPlanId: json.razorpayPlanId || json.razorpay_plan_id || undefined,
    isActive: json.is_active === true || json.status === 1 || json.is_active === undefined,
    sortOrder: json.sort_order ? parseInt(String(json.sort_order), 10) : 0,
  };
}

export function formatBillingCycle(cycle: any): string {
  if (cycle === null || cycle === undefined || cycle === '') return 'month';
  const str = String(cycle).trim();
  if (!str) return 'month';
  const clean = str.toUpperCase().replace(/\s+/g, '_');
  if (clean.includes('ANNUAL') || clean.includes('YEAR') || clean === '12' || clean === '365') return 'year';
  if (clean === 'MONTHLY' || clean === 'MONTH_1' || clean === '1_MONTH' || clean === '1MONTH' || clean === 'MONTH') return 'month';
  if (clean === 'QUARTERLY' || clean === 'MONTH_3' || clean === '3_MONTHS' || clean === '3MONTHS' || clean === '3' || clean === '90') return '3 months';
  if (
    clean === 'HALF_YEARLY' ||
    clean === 'SEMI_ANNUAL' ||
    clean === 'BIANNUAL' ||
    clean === 'BI_ANNUAL' ||
    clean === 'MONTH_6' ||
    clean === '6_MONTHS' ||
    clean === '6MONTHS' ||
    clean === '6_MONTH' ||
    clean === 'SIX_MONTHS' ||
    clean === '6' ||
    clean === '180'
  ) return '6 months';
  if (clean === 'WEEKLY' || clean === 'DAY_7' || clean === '7_DAYS' || clean === '7DAYS' || clean === '7') return 'week';
  if (clean === 'DAILY' || clean === 'DAY_1' || clean === '1_DAY' || clean === '1DAY' || clean === '1') return 'day';
  if (clean === 'ONE_TIME' || clean === 'LIFETIME') return 'lifetime';

  const m = clean.match(/^MONTH_?(\d+)$/) || clean.match(/^(\d+)_?MONTHS?$/);
  if (m) return `${m[1]} months`;
  const d = clean.match(/^DAY_?(\d+)$/) || clean.match(/^(\d+)_?DAYS?$/);
  if (d) return `${d[1]} days`;
  const y = clean.match(/^YEAR_?(\d+)$/) || clean.match(/^(\d+)_?YEARS?$/);
  if (y) return `${y[1]} years`;

  return str.toLowerCase().replace(/_/g, ' ');
}

export interface AdminPage {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon?: string;
}

export interface PlaybackConfig {
  ads: import('../services/adPlayback').PlaybackAd[];
  streamUrl: string;
  adSessionId?: string;
  adMarkers: number[];
  isHls: boolean;
  /** Authorized playback session token from POST /video/play (heartbeat/stop). */
  sessionToken?: string;
  /** Catalogue id the session was authorized for. */
  contentId?: number | string;
  episodeId?: number;
  showAds?: boolean;
}
