import { CatalogItem, CatalogLanguage } from '../types';
import { MAIN_TYPE_IDS } from '../constants/catalogConstants';

/**
 * Determine the Main Type ID of any CatalogItem
 * 1: Movies, 2: Songs, 3: Shorts, 4: Micro-Drama, 5: Podcasts, 6: Series, 7: AI Cinema
 */
export function getItemMainType(item: CatalogItem): number {
  if (!item) return MAIN_TYPE_IDS.MOVIES;
  const tId = Number((item as any).type_id || item.typeId || (item as any).type || (item as any).video_type || item.videoType || 0);
  const cType = String((item as any).contentType || (item as any).content_type || '').toUpperCase().trim();
  const name = String(item.name || (item as any).title || '').toLowerCase();
  const genres = (item.genres || []).map((g: any) => String(g).toLowerCase());
  const categoryName = String((item as any).category_name || item.categoryName || '').toLowerCase();
  const desc = String(item.description || '').toLowerCase();

  // 0. Explicit Movies (type 1) - prioritize explicit MOVIE content types
  if (cType === 'MOVIE' || cType === 'FILM') {
    return MAIN_TYPE_IDS.MOVIES;
  }

  // 1. AI Cinema (type 7)
  if (
    tId === MAIN_TYPE_IDS.AI_CINEMA ||
    cType.includes('AI') ||
    name.startsWith('ai ') ||
    name.includes('ai cinema') ||
    genres.some((g: string) => g.includes('ai cinema') || g === 'ai')
  ) {
    return MAIN_TYPE_IDS.AI_CINEMA;
  }

  // 2. Podcasts (type 5)
  if (
    tId === MAIN_TYPE_IDS.PODCASTS ||
    cType === 'PODCAST' ||
    name.includes('podcast') ||
    categoryName.includes('podcast') ||
    genres.some((g: string) => g.includes('podcast')) ||
    desc.includes('podcast') ||
    desc.includes('episode')
  ) {
    return MAIN_TYPE_IDS.PODCASTS;
  }

  // 3. Micro-Drama (type 4)
  if (
    tId === MAIN_TYPE_IDS.MICRO_DRAMA ||
    cType === 'MICRODRAMA' ||
    cType === 'MICRO_DRAMA' ||
    name.includes('micro') ||
    categoryName.includes('micro') ||
    genres.some((g: string) => g.includes('micro')) ||
    desc.includes('micro drama') ||
    desc.includes('micro-drama')
  ) {
    return MAIN_TYPE_IDS.MICRO_DRAMA;
  }

  // 4. Shorts (type 3)
  if (
    tId === MAIN_TYPE_IDS.SHORTS ||
    cType === 'SHORT' ||
    cType === 'SHORT_FILM' ||
    name.includes('short') ||
    categoryName.includes('short') ||
    genres.some((g: string) => g.includes('short')) ||
    desc.includes('short film')
  ) {
    return MAIN_TYPE_IDS.SHORTS;
  }

  // 5. Songs / Music / Albums (type 2)
  if (
    tId === MAIN_TYPE_IDS.SONGS ||
    cType === 'SONG' ||
    cType === 'ALBUM' ||
    cType === 'MUSIC' ||
    cType === 'MUSIC_VIDEO' ||
    name.includes('song') ||
    name.includes('album') ||
    name.includes('audio') ||
    name.includes('jukebox') ||
    categoryName.includes('music') ||
    categoryName.includes('song') ||
    genres.some((g: string) => g.includes('music') || g.includes('song') || g.includes('album'))
  ) {
    return MAIN_TYPE_IDS.SONGS;
  }

  // 6. Series / Shows (type 6)
  if (
    tId === MAIN_TYPE_IDS.SERIES ||
    cType === 'SERIES' ||
    cType === 'SHOW' ||
    name.includes('series') ||
    name.includes('show') ||
    name.includes('season') ||
    categoryName.includes('series') ||
    categoryName.includes('show') ||
    genres.some((g: string) => g.includes('series') || g.includes('show'))
  ) {
    return MAIN_TYPE_IDS.SERIES;
  }

  // 7. Movies (type 1 - default)
  return MAIN_TYPE_IDS.MOVIES;
}

/**
 * Checks if item matches the target Main Type (0 means all types)
 */
export function matchesMainType(item: CatalogItem, targetTypeId: number): boolean {
  if (targetTypeId === MAIN_TYPE_IDS.ALL) return true;
  return getItemMainType(item) === targetTypeId;
}

/**
 * Extracts language name / string from CatalogItem
 */
export function extractLanguageString(item: CatalogItem): string {
  if (!item) return '';
  let lang =
    (item as any).language_name ||
    item.languageName ||
    item.language ||
    item.originalLanguageCode ||
    (item as any).original_language_code ||
    (item as any).originalLanguage ||
    (item as any).original_language ||
    '';
  if (Array.isArray((item as any).languages) && (item as any).languages.length > 0) {
    const primary = (item as any).languages[0];
    if (typeof primary === 'string') lang = primary;
    else if (primary?.name || primary?.code) lang = primary.name || primary.code;
  }
  if (typeof lang === 'object' && lang !== null) {
    lang = lang.name || lang.code || lang.language || '';
  }
  return String(lang || '').toLowerCase().trim();
}

const NON_KANNADA_LANG_IDS = new Set([2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 99]);
const KANNADA_LANG_IDS = new Set([1, 6]);

const NON_KANNADA_CODES = new Set([
  'te', 'ta', 'hi', 'ml', 'bn', 'mr', 'pa', 'gu', 'or', 'as', 'en', 'all_indian', 'all-indian'
]);

// Word-boundary matching for non-Kannada languages in title, description, category or genre tags
const NON_KANNADA_WORD_REGEX = /\b(telugu|tamil|hindi|malayalam|bengali|marathi|punjabi|gujarati|odia|oriya|assamese|english)\b/i;
const KANNADA_WORD_REGEX = /\b(kannada|kannad)\b/i;

/**
 * Checks if a catalog item is strictly Kannada content (High-Performance O(1) fast-path)
 */
export function isKannadaCatalogItem(item: CatalogItem): boolean {
  if (!item) return false;

  // 1. Text & Metadata inspection: Title, Description, Genre, Category
  const title = String(item.name || (item as any).title || '');
  const desc = String(item.description || '');
  const categoryName = String((item as any).category_name || item.categoryName || '');
  const genres = (item.genres || []).map((g: any) => String(g)).join(' ');
  const combinedText = `${title} ${desc} ${categoryName} ${genres}`;

  // If any non-Kannada language keyword is found in title or metadata, strictly REJECT:
  if (NON_KANNADA_WORD_REGEX.test(combinedText)) {
    return false;
  }

  // 2. Language Code check
  const code = (
    item.originalLanguageCode ||
    (item as any).original_language_code ||
    (item as any).language_code ||
    ''
  ).toLowerCase().trim();

  if (NON_KANNADA_CODES.has(code)) return false;

  // 3. Language String check
  const langStr = extractLanguageString(item);
  if (
    langStr.includes('telugu') || langStr.includes('tamil') ||
    langStr.includes('hindi') || langStr.includes('malayalam') ||
    langStr.includes('bengali') || langStr.includes('marathi') ||
    langStr.includes('punjabi') || langStr.includes('gujarati') ||
    langStr.includes('odia') || langStr.includes('english') ||
    langStr.includes('all indian') || langStr.includes('all_indian')
  ) {
    return false;
  }

  // 4. Integer Language ID
  const langId = Number(
    item.languageId ||
    (item as any).language_id ||
    (item as any).language?.id ||
    (item as any).languageId ||
    0
  );

  // 5. Explicit Kannada markers (fast-track)
  if (code === 'kn' || code === 'kan' || langStr.includes('kannada') || langStr === 'kn' || KANNADA_LANG_IDS.has(langId)) {
    return true;
  }

  // 6. Integer Language ID check
  if (NON_KANNADA_LANG_IDS.has(langId)) return false;

  // 7. Default fallback for genuine platform titles without explicit language markers
  return true;
}

/**
 * Checks if a catalog item is strictly Non-Kannada Indian content
 */
export function isNonKannadaCatalogItem(item: CatalogItem): boolean {
  if (!item) return false;
  return !isKannadaCatalogItem(item);
}

/**
 * Checks if item matches a given Indian sub-language in All Indian Languages portal
 */
export function matchesIndianSubLanguage(
  item: CatalogItem,
  targetLang: string,
  languagesList: CatalogLanguage[] = []
): boolean {
  if (!targetLang || targetLang === 'all' || targetLang === 'all_indian') {
    return isNonKannadaCatalogItem(item);
  }
  const target = targetLang.toLowerCase().trim();
  const itemLang = extractLanguageString(item);
  const itemCode = (item.originalLanguageCode || '').toLowerCase().trim();
  const itemLangId = Number(item.languageId || item.language_id || (item as any).language?.id || 0);
  const title = String(item.name || (item as any).title || '').toLowerCase();
  const desc = String(item.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  // Word-boundary check for target language in title or description
  const targetRegex = new RegExp(`\\b${target}\\b`, 'i');
  if (targetRegex.test(text)) {
    return true;
  }

  const matchedLang = languagesList.find(
    (l) => l.name.toLowerCase() === target || (l.code && l.code.toLowerCase() === target)
  );
  const targetLangId = matchedLang ? matchedLang.id : 0;
  if (targetLangId > 0 && itemLangId === targetLangId) return true;

  if (itemLang === target || itemLang.includes(target) || itemCode === target) return true;

  if (target === 'telugu' && (itemCode === 'te' || itemLang === 'te' || itemLang.includes('telugu') || itemLangId === 8)) return true;
  if (target === 'tamil' && (itemCode === 'ta' || itemLang === 'ta' || itemLang.includes('tamil') || itemLangId === 2 || itemLangId === 7)) return true;
  if (target === 'hindi' && (itemCode === 'hi' || itemLang === 'hi' || itemLang.includes('hindi') || itemLangId === 3 || itemLangId === 4)) return true;
  if (target === 'malayalam' && (itemCode === 'ml' || itemLang === 'ml' || itemLang.includes('malayalam') || itemLangId === 5)) return true;
  if (target === 'bengali' && (itemCode === 'bn' || itemLang === 'bn' || itemLang.includes('bengali') || itemLangId === 9)) return true;
  if (target === 'marathi' && (itemCode === 'mr' || itemLang === 'mr' || itemLang.includes('marathi') || itemLangId === 10)) return true;
  if (target === 'punjabi' && (itemCode === 'pa' || itemLang === 'pa' || itemLang.includes('punjabi') || itemLangId === 11)) return true;
  if (target === 'gujarati' && (itemCode === 'gu' || itemLang === 'gu' || itemLang.includes('gujarati') || itemLangId === 12)) return true;
  if (target === 'odia' && (itemCode === 'or' || itemLang === 'or' || itemLang.includes('odia') || itemLangId === 13)) return true;
  if (target === 'assamese' && (itemCode === 'as' || itemLang === 'as' || itemLang.includes('assamese'))) return true;
  return false;
}

/**
 * Returns formatted release year string for UI badges/metadata
 */
export function formatReleaseYear(item: CatalogItem): string {
  if (!item) return '';
  if (item.releaseYear) return String(item.releaseYear).trim();
  if (typeof item.releaseDate === 'string') {
    const match = item.releaseDate.match(/\b(19|20)\d{2}\b/);
    if (match) return match[0];
  }
  return '';
}

/**
 * Formats duration seconds to e.g. "124 min" or "2h 4m"
 */
export function formatDurationMinutes(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}
