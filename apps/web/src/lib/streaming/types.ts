export type ContentKind = 'movie' | 'series' | 'live';

export type PlanTier = 'free' | 'basic' | 'premium';

export interface StreamEpisode {
  id: string;
  number: number;
  title: string;
  durationMin: number;
  synopsis: string;
  stillUrl: string;
}

export interface CastMember {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
}

export interface StreamTitle {
  id: string;
  videoId?: number;
  videoType?: number;
  typeId?: number;
  title: string;
  kind: ContentKind;
  posterUrl: string;
  backdropUrl: string;
  synopsis: string;
  rating: number;
  year: number;
  durationMin?: number;
  languages: string[];
  genres: string[];
  maturity: string;
  progressPercent?: number;
  requiresPlan: PlanTier;
  top10Rank?: number;
  isOriginal?: boolean;
  liveBadge?: string;
  episodes?: StreamEpisode[];
  cast: CastMember[];
  relatedIds: string[];
  isBookmarked?: boolean;
}

export interface StreamProfile {
  id: string;
  name: string;
  avatarUrl: string;
  kids: boolean;
}

export interface HomeRow {
  id: string;
  title: string;
  variant: 'standard' | 'top10' | 'landscape';
  titleIds: string[];
}

export interface NotificationItem {
  id: string;
  type: 'episode' | 'billing' | 'promo' | 'reminder';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

export interface CategoryItem {
  id: string;
  label: string;
  description: string;
  icon: 'film' | 'tv' | 'radio' | 'baby' | 'trophy' | 'sparkles' | 'globe';
  href: string;
}

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlighted?: boolean;
}
