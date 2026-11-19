/**
 * Shared formatting utilities for MaxxPixels OTT Admin
 */

const LANGUAGE_MAP: Record<string, string> = {
  kn: 'Kannada',
  kan: 'Kannada',
  kannada: 'Kannada',
  te: 'Telugu',
  tel: 'Telugu',
  telugu: 'Telugu',
  ta: 'Tamil',
  tam: 'Tamil',
  tamil: 'Tamil',
  hi: 'Hindi',
  hin: 'Hindi',
  hindi: 'Hindi',
  ml: 'Malayalam',
  mal: 'Malayalam',
  malayalam: 'Malayalam',
  en: 'English',
  eng: 'English',
  english: 'English',
  'en-us': 'English (US)',
  'en-gb': 'English (UK)',
  mr: 'Marathi',
  mar: 'Marathi',
  marathi: 'Marathi',
  bn: 'Bengali',
  ben: 'Bengali',
  bengali: 'Bengali',
  pa: 'Punjabi',
  pan: 'Punjabi',
  punjabi: 'Punjabi',
  gu: 'Gujarati',
  guj: 'Gujarati',
  gujarati: 'Gujarati',
  or: 'Odia',
  ori: 'Odia',
  odia: 'Odia',
  as: 'Assamese',
  asm: 'Assamese',
  assamese: 'Assamese',
  ur: 'Urdu',
  urd: 'Urdu',
  urdu: 'Urdu',
  sa: 'Sanskrit',
  san: 'Sanskrit',
  sanskrit: 'Sanskrit',
  es: 'Spanish',
  spa: 'Spanish',
  spanish: 'Spanish',
  fr: 'French',
  fre: 'French',
  fra: 'French',
  french: 'French',
  de: 'German',
  ger: 'German',
  deu: 'German',
  german: 'German',
  ja: 'Japanese',
  jpn: 'Japanese',
  japanese: 'Japanese',
  ko: 'Korean',
  kor: 'Korean',
  korean: 'Korean',
  zh: 'Chinese',
  zho: 'Chinese',
  chi: 'Chinese',
  chinese: 'Chinese',
  ar: 'Arabic',
  ara: 'Arabic',
  arabic: 'Arabic',
  ru: 'Russian',
  rus: 'Russian',
  russian: 'Russian'
};

/**
 * Formats a language code or string to its full readable name
 */
export function formatLanguage(lang?: string | null): string {
  if (!lang || !lang.trim()) return 'Not set';
  const clean = lang.trim();
  const lower = clean.toLowerCase();
  if (LANGUAGE_MAP[lower]) {
    return LANGUAGE_MAP[lower];
  }
  // Title-case fallback
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Formats maturity ratings like UA_13+ to U/A 13+
 */
export function formatMaturityRating(rating?: string | null): string {
  if (!rating || !rating.trim()) return 'All Ages';
  const r = rating.trim().toUpperCase();

  switch (r) {
    case 'U':
    case 'UNIVERSAL':
      return 'U';
    case 'UA':
    case 'U_A':
      return 'U/A';
    case 'UA_7+':
    case 'UA_7':
    case 'UA7+':
    case 'U/A 7+':
    case 'PG':
      return 'U/A 7+';
    case 'UA_13+':
    case 'UA_13':
    case 'UA13+':
    case 'U/A 13+':
    case 'PG_13':
    case 'PG-13':
      return 'U/A 13+';
    case 'UA_16+':
    case 'UA_16':
    case 'UA16+':
    case 'U/A 16+':
      return 'U/A 16+';
    case 'A':
    case 'A_18+':
    case 'A_18':
    case 'A18+':
    case 'ADULT':
    case 'ADULTS':
    case 'NC_17':
    case 'NC-17':
    case 'R':
      return 'A 18+';
    case 'TV_MA':
    case 'TV-MA':
      return 'TV-MA';
    case 'TV_14':
    case 'TV-14':
      return 'TV-14';
    case 'TV_PG':
    case 'TV-PG':
      return 'TV-PG';
    case 'TV_G':
    case 'TV-G':
      return 'TV-G';
    case 'TV_Y':
    case 'TV-Y':
      return 'TV-Y';
    case 'TV_Y7':
    case 'TV-Y7':
      return 'TV-Y7';
    default:
      return r.replace(/_/g, ' ');
  }
}

/**
 * Returns CSS color class for maturity rating badge
 */
export function getMaturityRatingBadgeClass(rating?: string | null): string {
  const formatted = formatMaturityRating(rating);
  if (formatted === 'U' || formatted === 'TV-G' || formatted === 'TV-Y') {
    return 'badge-rating-green';
  }
  if (formatted === 'U/A 7+' || formatted === 'TV-PG' || formatted === 'TV-Y7') {
    return 'badge-rating-cyan';
  }
  if (formatted === 'U/A 13+' || formatted === 'PG-13' || formatted === 'TV-14') {
    return 'badge-rating-amber';
  }
  if (formatted === 'U/A 16+') {
    return 'badge-rating-orange';
  }
  if (formatted === 'A 18+' || formatted === 'TV-MA' || formatted === 'NC-17') {
    return 'badge-rating-red';
  }
  return 'badge-rating-default';
}

/**
 * Formats duration from minutes or string to e.g. "2h 40m"
 */
export function formatDuration(minutes?: number | null, rawTime?: string | null): string {
  if (minutes && minutes > 0) {
    const totalMinutes = Math.round(minutes);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins} mins`;
  }
  if (rawTime && rawTime.trim()) {
    return rawTime.trim();
  }
  return 'Not set';
}

/**
 * Generates an SVG Data URL placeholder for posters with high visual quality
 */
export function generatePosterPlaceholder(title?: string, contentType?: string, language?: string): string {
  const displayTitle = (title || 'Content').trim();
  const initial = (displayTitle.charAt(0) || 'M').toUpperCase();
  const cleanType = (contentType || 'MOVIE').replace(/_/g, ' ').toUpperCase();
  const langTag = language ? formatLanguage(language).substring(0, 10) : '';

  const encodedInitial = encodeURIComponent(initial);
  const encodedType = encodeURIComponent(cleanType.length > 14 ? cleanType.substring(0, 12) + '..' : cleanType);
  const encodedLang = encodeURIComponent(langTag);

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180" viewBox="0 0 120 180">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="%231e1e2f"/>
        <stop offset="50%" stop-color="%2312121c"/>
        <stop offset="100%" stop-color="%230a0a12"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="%23e50914"/>
        <stop offset="100%" stop-color="%23b81d24"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%2300e5ff" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="%2300e5ff" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <rect width="120" height="180" rx="10" fill="url(%23g)"/>
    <rect x="1" y="1" width="118" height="178" rx="9" fill="none" stroke="%232a2a3e" stroke-width="1.5"/>
    <rect x="0" y="0" width="120" height="4" rx="2" fill="url(%23accent)"/>
    <circle cx="60" cy="72" r="32" fill="url(%23glow)"/>
    <circle cx="60" cy="72" r="28" fill="%23181824" stroke="%233a3a52" stroke-width="1.5"/>
    <text x="60" y="81" text-anchor="middle" fill="%23ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800">${encodedInitial}</text>
    <rect x="16" y="126" width="88" height="18" rx="4" fill="%23222234"/>
    <text x="60" y="139" text-anchor="middle" fill="%23e50914" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" letter-spacing="0.5">${encodedType}</text>
    ${encodedLang ? `<text x="60" y="160" text-anchor="middle" fill="%2394a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="500">${encodedLang}</text>` : ''}
  </svg>`.replace(/\s+/g, ' ');
}
