import { CatalogItem } from '../types';

export type RootStackParamList = {
  Splash: undefined;
  PortalSelection: undefined;
  Main: { initialTypeId?: number } | undefined;
  Home: { initialTypeId?: number } | undefined;
  Explore: undefined;
  NewHot: undefined;
  Profile: undefined;
  Details: { movie: CatalogItem };
  Player: {
    videoId: number | string;
    videoType: number;
    title: string;
    videoUrl?: string;
    item?: CatalogItem;
  };
  Login: { mode?: 'signin' | 'signup' } | undefined;
  Subscription: undefined;
  CategoryContent: {
    categoryId?: number;
    videoType?: number;
    typeId?: number;
    title: string;
    initialItems?: CatalogItem[];
  };
  Account: undefined;
  Rentals: undefined;
  Shorts: undefined;
  MaxxShopping: undefined;
  Settings: undefined;
  Preferences: undefined;
  Storage: undefined;
  Downloads: undefined;
  MyDownloads: undefined;
  PrivacyLegal: undefined;
  HelpSupport: undefined;
  Notifications: undefined;
  ComingSoon: { portalType: 'ecommerce' | 'games' | 'ai_movies' | 'yellowboard'; title?: string };
  GamesWebView: { launchUrl?: string; title?: string; game?: string };
  GamesWallet: { recommendedCoins?: number } | undefined;
};
