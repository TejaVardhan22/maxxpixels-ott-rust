export interface ResolvedLanguage {
  code: string;
  name: string;
  id: number;
  isKannada: boolean;
}

interface LangDef {
  code: string;
  name: string;
  id: number;
  aliases: string[];
}

const LANGUAGE_DEFINITIONS: LangDef[] = [
  { code: 'kn', name: 'Kannada', id: 6, aliases: ['kn', 'kan', 'kannada', '6'] },
  { code: 'te', name: 'Telugu', id: 5, aliases: ['te', 'tel', 'telugu', '5'] },
  { code: 'hi', name: 'Hindi', id: 4, aliases: ['hi', 'hin', 'hindi', '4'] },
  { code: 'ta', name: 'Tamil', id: 7, aliases: ['ta', 'tam', 'tamil', '7'] },
  { code: 'ml', name: 'Malayalam', id: 8, aliases: ['ml', 'mal', 'malayalam', '8'] },
  { code: 'en', name: 'English', id: 1, aliases: ['en', 'eng', 'english', '1'] },
  { code: 'mr', name: 'Marathi', id: 9, aliases: ['mr', 'mar', 'marathi', '9'] },
  { code: 'bn', name: 'Bengali', id: 10, aliases: ['bn', 'ben', 'bengali', '10'] },
  { code: 'gu', name: 'Gujarati', id: 11, aliases: ['gu', 'guj', 'gujarati', '11'] },
  { code: 'pa', name: 'Punjabi', id: 12, aliases: ['pa', 'pan', 'punjabi', '12'] },
  { code: 'bho', name: 'Bhojpuri', id: 3, aliases: ['bho', 'bhojpuri', '3'] },
];

export class LanguageResolver {
  static resolveFromString(raw?: string | null): ResolvedLanguage {
    if (!raw || !raw.trim()) {
      return { code: 'kn', name: 'Kannada', id: 6, isKannada: true };
    }
    const clean = raw.trim().toLowerCase();
    for (const def of LANGUAGE_DEFINITIONS) {
      if (def.aliases.includes(clean)) {
        return {
          code: def.code,
          name: def.name,
          id: def.id,
          isKannada: def.code === 'kn',
        };
      }
    }
    const cap = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
    const shortCode = clean.length >= 2 ? clean.substring(0, 2) : clean;
    return {
      code: shortCode,
      name: cap,
      id: 1,
      isKannada: shortCode === 'kn' || clean.includes('kannada'),
    };
  }

  static resolve(content?: {
    originalLanguageCode?: string | null;
    languages?: Array<{ id?: number; code?: string; name?: string }> | null;
  } | null): ResolvedLanguage {
    if (!content) {
      return { code: 'kn', name: 'Kannada', id: 6, isKannada: true };
    }
    if (content.originalLanguageCode && content.originalLanguageCode.trim()) {
      return this.resolveFromString(content.originalLanguageCode);
    }
    if (content.languages && content.languages.length > 0) {
      const first = content.languages[0];
      if (first.code) {
        const res = this.resolveFromString(first.code);
        return {
          ...res,
          id: first.id ?? res.id,
          name: first.name || res.name,
        };
      }
      if (first.name) {
        return this.resolveFromString(first.name);
      }
    }
    return { code: 'kn', name: 'Kannada', id: 6, isKannada: true };
  }
}

export function resolveLanguage(queryLang?: string, acceptLanguageHeader?: string): string | undefined {
  if (queryLang && queryLang.trim()) {
    return queryLang.trim().toLowerCase();
  }
  if (acceptLanguageHeader && acceptLanguageHeader.trim()) {
    const primary = acceptLanguageHeader.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
    if (primary && primary !== '*') {
      return primary;
    }
  }
  return undefined;
}
