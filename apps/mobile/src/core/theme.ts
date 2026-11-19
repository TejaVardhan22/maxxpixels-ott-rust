export const AppTheme = {
  background: '#08090C',
  surface: '#11141E',
  surfaceElevated: '#181B26',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',
  primary: '#E50914',
  primaryDark: '#B80710',
  primaryLight: '#FF3B44',
  primaryGlow: 'rgba(229, 9, 20, 0.35)',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDark: '#08090C',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  card: '#11141E',
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  gold: '#F59E0B',
  goldLight: '#FDE68A',
  goldBg: 'rgba(245, 158, 11, 0.15)',
  tagBg: 'rgba(229, 9, 20, 0.15)',
  overlay: 'rgba(8, 9, 12, 0.85)',

  // Color object alias for safe nested access across components
  get colors() {
    return this;
  },
};

export const AppTypography = {
  fontFamily: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};
