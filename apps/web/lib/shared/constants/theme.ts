export const colors = {
  /** Brand CTA / active tint (unified across mobile + web primary actions) */
  primary: '#F5C518',
  primaryDark: '#C9A012',
  /** Subtle fills behind icons, chips, list highlights */
  primarySoft: 'rgba(245,197,24,0.15)',
  primaryMuted: 'rgba(245,197,24,0.08)',
  primarySurface: 'rgba(245,197,24,0.10)',
  primaryBorder: 'rgba(245,197,24,0.4)',
  primaryBorderLight: 'rgba(245,197,24,0.3)',
  primaryGlow: 'rgba(245,197,24,0.25)',
  /** Decorative purple accent (gradients, non-CTA emphasis) */
  purpleGlow: 'rgba(139,92,246,0.25)',
  accent: '#E50914',
  accentLight: '#FF3D4F',

  background: '#0A0A0A',
  surface: '#111111',
  surfaceLight: '#1C1C1C',
  card: '#141414',
  cardHover: '#1E1E1E',
  overlay: 'rgba(0,0,0,0.7)',
  overlayHeavy: 'rgba(0,0,0,0.85)',

  titleText: '#FFFFFF',
  bodyText: '#E5E5E5',
  descText: '#A3A3A3',
  mutedText: '#737373',
  placeholderText: '#525252',

  border: '#2A2A2A',
  borderLight: '#3A3A3A',
  divider: '#1A1A1A',

  icon: '#A3A3A3',
  iconActive: '#FFFFFF',

  shimmer: '#1E1E1E',
  shimmerItem: '#141414',

  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
  error: '#EF4444',

  gold: '#F5C518',
  premium: '#8B5CF6',

  gradient: {
    hero: ['transparent', 'rgba(10,10,10,0.5)', '#0A0A0A'],
    card: ['transparent', 'rgba(0,0,0,0.85)'],
    premium: ['#8B5CF6', '#3B82F6'],
    accent: ['#E50914', '#FF6B35'],
    purple: ['#8B5CF6', '#3B82F6'],
    purpleDark: ['#7C3AED', '#2563EB'],
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const typography = {
  hero: { size: 40, weight: '800' as const, lineHeight: 1.1 },
  h1: { size: 28, weight: '700' as const, lineHeight: 1.2 },
  h2: { size: 22, weight: '700' as const, lineHeight: 1.3 },
  h3: { size: 18, weight: '600' as const, lineHeight: 1.3 },
  body: { size: 15, weight: '400' as const, lineHeight: 1.5 },
  bodyBold: { size: 15, weight: '600' as const, lineHeight: 1.5 },
  small: { size: 13, weight: '400' as const, lineHeight: 1.4 },
  caption: { size: 11, weight: '500' as const, lineHeight: 1.3 },
  button: { size: 14, weight: '600' as const, lineHeight: 1 },
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const shadows = {
  card: '0 2px 8px rgba(0,0,0,0.4)',
  elevated: '0 8px 24px rgba(0,0,0,0.6)',
  glow: (color: string) => `0 0 20px ${color}40`,
} as const;

export const dimens = {
  cardRadius: 8,
  spaceBetweenCards: 8,
  spaceBetweenCardsWeb: 12,
  homeBanner: 400,
  homeWebBanner: 560,
  appBarHeight: 64,
  bottomNavHeight: 64,
  posterWidth: 140,
  posterHeight: 200,
  landscapeWidth: 220,
  landscapeHeight: 130,
  shortsWidth: 120,
  shortsHeight: 200,
} as const;

export const contentTypes = {
  dynamicContentType: 0,
  manualContentType: 1,
  aiContentType: 2,
  movieContentType: 1,
  showContentType: 2,
  genresType: 3,
  languageType: 4,
  upcomingContentType: 5,
  channelContentType: 6,
  kidsContentType: 7,
  clipsContentType: 8,
  continueWatchType: 101,
  channelType: 102,
  rentContentType: 103,
} as const;

export const settingKeys = {
  googleClientIdKey: 'web_client_id',
  onesignalAppIdKey: 'onesignal_app_id',
  vapidKey: 'vapid_key',
  parentControlStatus: 'parent_control_status',
  subscriptionStatus: 'subscription_status',
  watchlistStatus: 'watchlist_status',
  downloadStatus: 'download_status',
  continueWatchingStatus: 'continue_watching_status',
  introScreenStatus: 'on_boarding_screen_status',
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;
