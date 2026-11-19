export interface ApiListResponse<T> {
  status?: number;
  message?: string;
  result?: T;
  total_rows?: number;
  total_page?: number;
  current_page?: number;
  more_page?: boolean;
}

export interface LoginUserResult {
  id?: number | string;
  uuid?: string;
  full_name?: string;
  user_name?: string;
  mobile_number?: string;
  phoneNumber?: string;
  email?: string;
  date_of_birth?: string;
  dateOfBirth?: string;
  dob?: string;
  profession?: string;
  pincode?: string;
  pin_code?: string;
  image?: string;
  status?: number;
  type?: number;
  expiry_date?: string;
  device_type?: number | string;
  device_id?: string;
  device_token?: string;
  parent_control_status?: number;
  parent_control_password?: string;
  created_at?: string;
  updated_at?: string;
  is_buy?: number;
  reference_code?: string;
  wallet_amount?: number | string;
  package_name?: string;
  upcoming_package?: unknown;
  /** Sanctum personal access token issued by the backend on login */
  auth_token?: string;
  refresh_token?: string;
  is_verified?: boolean;
}

export interface GeneralSettingRow {
  id?: number;
  key?: string;
  value?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Banner {
  id?: number;
  name?: string;
  image?: string;
  video_type?: number;
  type_id?: number;
  video_id?: number;
  sub_video_type?: number;
  is_home_screen?: number;
  status?: number;
  [key: string]: unknown;
}

export interface PortalBanner {
  id?: number;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  targetUrl?: string;
  portalKey?: string;
  buttonLabel?: string;
  displayOrder?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface IntroVideo {
  id?: number;
  title?: string;
  description?: string;
  videoUrl?: string;
  posterUrl?: string;
  ctaLabel?: string;
  isActive?: boolean;
  displayOrder?: number;
  [key: string]: unknown;
}

export interface Section {
  id?: number;
  title?: string;
  short_title?: string;
  video_type?: number;
  type_id?: number;
  section_type?: number;
  screen_layout?: string;
  is_home_screen?: number;
  status?: number;
  data?: ContentItem[];
  [key: string]: unknown;
}

export interface ContentItem {
  id?: number;
  name?: string;
  description?: string;
  image?: string;
  landscape?: string;
  thumbnail?: string;
  video_type?: number;
  type_id?: number;
  video_id?: number;
  sub_video_type?: number;
  release_year?: string;
  video_duration?: number | string;
  video_url?: string;
  video_240?: string;
  video_320?: string;
  video_480?: string;
  video_720?: string;
  video_1080?: string;
  trailer_url?: string;
  subtitle_type?: number;
  subtitle_1?: string;
  subtitle_2?: string;
  subtitle_3?: string;
  subtitle_tracks?: Array<{ label?: string; src?: string; srclang?: string }>;
  max_quality?: number;
  is_premium?: number;
  is_rent?: number;
  price?: number | string;
  rent_price?: number | string;
  rent_day?: number;
  rent_buy?: number;
  rent_expiry_date?: string;
  is_download?: number;
  category_name?: string;
  language_name?: string;
  channel_name?: string;
  producer_name?: string;
  is_like?: number;
  is_bookmark?: number;
  total_like?: number;
  total_view?: number;
  stop_time?: number | string;
  is_kids_profile?: number;
  status?: number;
  session_id?: number;
  cast?: CastMember[];
  director?: CastMember[];
  season?: Season[];
  [key: string]: unknown;
}

export interface CastMember {
  id?: number;
  name?: string;
  image?: string;
  type?: string;
  personal_info?: string;
  [key: string]: unknown;
}

export interface Season {
  id?: number;
  show_id?: number;
  name?: string;
  status?: number;
  [key: string]: unknown;
}

export interface Episode {
  id?: number;
  show_id?: number;
  season_id?: number;
  name?: string;
  description?: string;
  image?: string;
  landscape?: string;
  thumbnail?: string;
  video_url?: string;
  video_240?: string;
  video_320?: string;
  video_480?: string;
  video_720?: string;
  video_1080?: string;
  trailer_url?: string;
  video_duration?: number | string;
  subtitle_type?: number;
  subtitle_1?: string;
  subtitle_2?: string;
  subtitle_3?: string;
  subtitle_tracks?: Array<{ label?: string; src?: string; srclang?: string }>;
  is_download?: number;
  sort_order?: number;
  status?: number;
  [key: string]: unknown;
}

export interface Category {
  id?: number;
  type_id?: number;
  name?: string;
  slug?: string;
  image?: string;
  sort_order?: number;
  status?: number;
  [key: string]: unknown;
}

export interface Language {
  id?: number;
  name?: string;
  image?: string;
  status?: number;
  [key: string]: unknown;
}

export interface Channel {
  id?: number;
  name?: string;
  image?: string;
  status?: number;
  [key: string]: unknown;
}

export interface ContentType {
  id?: number;
  name?: string;
  icon?: string;
  type?: number;
  sort_order?: number;
  status?: number;
  [key: string]: unknown;
}

export interface SubscriptionPackage {
  id?: number;
  name?: string;
  price?: number | string;
  currency_code?: string;
  duration?: number;
  duration_type?: string;
  time?: number;
  type?: string;
  android_product_id?: string;
  ios_product_id?: string;
  is_buy?: number;
  is_active_plan?: number;
  status?: number;
  data?: PackageDetail[];
  [key: string]: unknown;
}

export interface PackageDetail {
  id?: number;
  package_id?: number;
  title?: string;
  status?: number;
  [key: string]: unknown;
}

export interface Transaction {
  id?: number;
  user_id?: number;
  package_id?: number;
  unique_id?: string;
  transaction_id?: string;
  price?: number | string;
  description?: string;
  payment_type?: number;
  transaction_status?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Comment {
  id?: number;
  user_id?: number;
  video_type?: number;
  video_id?: number;
  sub_video_type?: number;
  comment?: string;
  comment_id?: number;
  status?: number;
  created_at?: string;
  updated_at?: string;
  full_name?: string;
  user_image?: string;
  reply_count?: number;
  [key: string]: unknown;
}

export interface Notification {
  id?: number;
  title?: string;
  message?: string;
  image?: string;
  type?: number;
  video_type?: number;
  video_id?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface RazorpayOrderResult {
  id?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface RentTransaction {
  id?: number;
  user_id?: number;
  video_type?: number;
  sub_video_type?: number;
  video_id?: number;
  price?: number;
  expiry_date?: string;
  transaction_status?: number;
  [key: string]: unknown;
}

export interface Avatar {
  id?: number;
  image?: string;
  status?: number;
  [key: string]: unknown;
}

export interface SocialLink {
  id?: number;
  name?: string;
  url?: string;
  image?: string;
  status?: number;
  [key: string]: unknown;
}

export interface OnboardingScreen {
  id?: number;
  title?: string;
  description?: string;
  image?: string;
  status?: number;
  [key: string]: unknown;
}

export interface PageItem {
  id?: number;
  title?: string;
  url?: string;
  icon?: string;
  page_subtitle?: string;
  description?: string;
  status?: number;
  [key: string]: unknown;
}

export interface DeviceSync {
  id?: number;
  user_id?: number;
  device_id?: string;
  device_name?: string;
  device_type?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface TVLoginCode {
  id?: number;
  unique_code?: string;
  user_id?: number;
  status?: number;
  [key: string]: unknown;
}

export interface WalletTransaction {
  id?: number;
  user_id?: number;
  amount?: number | string;
  transaction_id?: string;
  type?: string;
  description?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface ReferEarn {
  id?: number;
  user_id?: number;
  referred_user_id?: number;
  amount?: number | string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Coupon {
  id?: number;
  name?: string;
  code?: string;
  discount?: number | string;
  discount_type?: number;
  unique_id?: string;
  amount_type?: number;
  price?: number | string;
  total_amount?: number;
  discount_amount?: number;
  start_date?: string;
  end_date?: string;
  status?: number;
  [key: string]: unknown;
}

export interface ShortsItem {
  id?: number;
  name?: string;
  image?: string;
  landscape?: string;
  thumbnail?: string;
  video_type?: number;
  type_id?: number;
  status?: number;
  [key: string]: unknown;
}

export interface ShortsEpisode {
  id?: number;
  shorts_id?: number;
  season_id?: number;
  name?: string;
  description?: string;
  image?: string;
  landscape?: string;
  thumbnail?: string;
  video_url?: string;
  video_320?: string;
  video_480?: string;
  video_720?: string;
  video_1080?: string;
  video_duration?: number | string;
  status?: number;
  is_like?: number;
  is_bookmark?: number;
  total_like?: number;
  total_view?: number;
  [key: string]: unknown;
}

export interface RentItem {
  id?: number;
  video_type?: number;
  video_id?: number;
  sub_video_type?: number;
  price?: number | string;
  rent_duration?: number;
  name?: string;
  image?: string;
  landscape?: string;
  [key: string]: unknown;
}

/** Generic fallback for unknown response shapes */
export type ContentRecord = Record<string, unknown>;
