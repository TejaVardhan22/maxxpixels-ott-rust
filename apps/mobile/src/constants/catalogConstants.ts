import React from 'react';
import {
  Sparkles,
  Film,
  Mic,
  Music,
  Tv,
  Smartphone,
  Video,
} from 'lucide-react-native';

export const MAIN_TYPE_IDS = {
  ALL: 0,
  MOVIES: 1,
  SONGS: 2,
  SHORTS: 3,
  MICRO_DRAMA: 4,
  PODCASTS: 5,
  SERIES: 6,
  AI_CINEMA: 7,
} as const;

export interface MainTypeItem {
  id: number;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  typeKey?: string;
}

export interface PortalPill {
  id: string | number;
  label: string;
  kind: 'all' | 'language' | 'main_type';
  mainTypeId?: number;
  langKey?: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
  typeKey?: string;
}

export const MAIN_TYPES: MainTypeItem[] = [
  { id: MAIN_TYPE_IDS.ALL, label: 'For You', icon: Sparkles, typeKey: 'all' },
  { id: MAIN_TYPE_IDS.MOVIES, label: 'Movies', icon: Film, typeKey: 'movie' },
  { id: MAIN_TYPE_IDS.PODCASTS, label: 'Podcasts', icon: Mic, typeKey: 'podcast' },
  { id: MAIN_TYPE_IDS.SONGS, label: 'Songs', icon: Music, typeKey: 'song' },
  { id: MAIN_TYPE_IDS.SERIES, label: 'Series', icon: Tv, typeKey: 'series' },
  { id: MAIN_TYPE_IDS.MICRO_DRAMA, label: 'Micro-Drama', icon: Smartphone, typeKey: 'micro' },
  { id: MAIN_TYPE_IDS.SHORTS, label: 'Shorts', icon: Video, typeKey: 'short' },
  { id: MAIN_TYPE_IDS.AI_CINEMA, label: 'AI Cinema', icon: Sparkles, typeKey: 'ai' },
];

export const INDIAN_LANGUAGES_EXCLUDING_KANNADA: { name: string; code: string }[] = [
  { name: 'Telugu', code: 'te' },
  { name: 'Tamil', code: 'ta' },
  { name: 'Malayalam', code: 'ml' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Bengali', code: 'bn' },
  { name: 'Marathi', code: 'mr' },
  { name: 'Gujarati', code: 'gu' },
  { name: 'Punjabi', code: 'pa' },
  { name: 'Odia', code: 'or' },
  { name: 'Assamese', code: 'as' },
];

export const BASE_INDIAN_LANGUAGES: { name: string; code: string }[] = [
  { name: 'Kannada', code: 'kn' },
  ...INDIAN_LANGUAGES_EXCLUDING_KANNADA,
];

export const EXPLORE_FILTER_CHIPS = [
  'All',
  'Movies',
  'Podcasts',
  'Songs',
  'Web Series',
  'Micro-Drama',
  'Shorts',
  'AI Cinema',
  'Free Content',
  'VIP 4K',
];

