import {
  CatalogCategory,
  CatalogContentType,
  CatalogItem,
  CatalogLanguage,
  HomeSection,
  parseCatalogItem,
} from '../types';
import { ApiClient } from './apiClient';
import { AuthService } from './authService';
import { AppConfig } from '../core/config';

export interface HomeCatalogResult {
  banners: CatalogItem[];
  sections: HomeSection[];
  latest: CatalogItem[];
  types: CatalogContentType[];
  categories: CatalogCategory[];
  errors: string[];
}

export class CatalogService {
  public static async getHomeCatalog(typeId: number = 0, lang?: string): Promise<HomeCatalogResult> {
    const errors: string[] = [];
    const queryParams: Record<string, any> = {};
    if (typeId > 0) {
      queryParams.typeId = typeId;
    }
    if (lang) {
      queryParams.language = lang;
    }
    const read = async (path: string): Promise<any[]> => {
      try {
        const result = await ApiClient.getApi(path, { queryParams });
        if (!Array.isArray(result)) throw new Error('Invalid catalog response');
        return result;
      } catch (error: any) {
        errors.push(error.message || 'Failed to load catalog');
        return [];
      }
    };

    const [bannerRows, sectionRows, categoryRows, typeRows] = await Promise.all([
      read('cms/banners'),
      read('cms/sections'),
      read('categories'),
      read('content-types').catch(() => []),
    ]);
    const matchesType = (item: CatalogItem) => {
      if (typeId === 0) return true;
      if (typeId === 1) {
        const ct = String((item as any).type || (item as any).contentType || '').toUpperCase().trim();
        if (ct === 'MOVIE' || ct === 'FILM' || item.typeId === 1 || item.videoType === 1) return true;
      }
      return item.typeId === typeId || item.videoType === typeId;
    };
    let banners = bannerRows
      .map((row) =>
        this.mapContentToCatalogItem({
          ...row,
          id: row.contentId || row.content_id || row.id,
        })
      )
      .filter(matchesType);

    const isContinueWatchingSection = (s: any) => {
      const title = String(s.title || s.name || '').toLowerCase();
      const type = String(s.sectionType || s.type || '').toUpperCase();
      return (
        title.includes('continue watching') ||
        title.includes('continue listening') ||
        type === 'CONTINUE_WATCHING' ||
        s.id === 999
      );
    };

    const sections: HomeSection[] = sectionRows
      .filter((s: any) => !isContinueWatchingSection(s))
      .map((section: any, index: number) => {
        const rawItems = Array.isArray(section.items)
          ? section.items
          : Array.isArray(section.data)
          ? section.data
          : [];
        return {
          id: Number(section.id || index + 1),
          videoType: Number(section.videoType || 1),
          title: section.title || section.name || '',
          landscape:
            section.layout === 'HORIZONTAL' ||
            section.screenLayout === 'landscape' ||
            section.screen_layout === 'landscape',
          data: rawItems
            .map((item: any) => this.mapContentToCatalogItem(item))
            .filter(matchesType),
        };
      })
      .filter((section) => section.data.length > 0);

    if (banners.length === 0 && sections.length > 0 && sections[0].data.length > 0) {
      banners = sections[0].data.slice(0, 6);
    }
    const categories = categoryRows.map((category: any) => ({
      id: Number(category.id),
      typeId: Number(category.typeId || 0),
      name: category.name || '',
      image: AppConfig.normalizeMediaUrl(category.imageUrl || category.image),
    }));
    const types: CatalogContentType[] =
      typeRows && typeRows.length > 0
        ? typeRows.map((t: any) => ({
            id: Number(t.id || 1),
            name: t.name || t.title || 'Category',
          }))
        : [
            { id: 1, name: 'Movies' },
            { id: 2, name: 'Songs' },
            { id: 3, name: 'Short Films' },
            { id: 4, name: 'Micro-Drama' },
            { id: 5, name: 'Podcasts' },
            { id: 6, name: 'Web Series' },
            { id: 7, name: 'AI Cinema' },
          ];

    return {
      banners,
      sections,
      categories,
      errors,
      latest: sections.find((section) => /recent|new/i.test(section.title))?.data || [],
      types,
    };
  }

  public static async getTypeList(): Promise<CatalogContentType[]> {
    try {
      const result = await ApiClient.getApi('content-types');
      if (Array.isArray(result) && result.length > 0) {
        return result.map((t: any) => ({
          id: Number(t.id || 1),
          name: t.name || t.title || 'Category',
        }));
      }
    } catch (e) {
      console.warn('getTypeList error:', e);
    }
    return [
      { id: 1, name: 'Movies' },
      { id: 2, name: 'Songs' },
      { id: 3, name: 'Short Films' },
      { id: 4, name: 'Micro-Drama' },
      { id: 5, name: 'Podcasts' },
      { id: 6, name: 'Web Series' },
    ];
  }

  public static async getContentDetail(itemOrId: any): Promise<CatalogItem | null> {
    const rawId =
      typeof itemOrId === 'object' && itemOrId
        ? itemOrId.id || itemOrId.videoId || itemOrId.contentId || itemOrId.slug
        : itemOrId;
    const cleanId = String(rawId ?? '').trim();

    // Direct REST API fetch
    try {
      if (cleanId && cleanId !== '0' && cleanId !== 'NaN' && cleanId !== 'undefined') {
        const result = await ApiClient.getApi(`catalog/${encodeURIComponent(cleanId)}`, {
          userToken: AuthService.authToken || undefined,
        });
        if (result && typeof result === 'object') {
          const itemData = (result as any).data || (result as any).result || result;
          return this.mapContentToCatalogItem(Array.isArray(itemData) ? itemData[0] : itemData);
        }
      }
    } catch (e) {
      console.warn('getContentDetail error:', e);
    }

    if (typeof itemOrId === 'object' && itemOrId) {
      return parseCatalogItem(itemOrId);
    }
    return null;
  }

  public static async searchContent(query: string): Promise<CatalogItem[]> {
    if (!query || query.trim().length === 0) return [];

    // Direct REST catalog search
    try {
      const results = await ApiClient.getApi('search', { queryParams: { q: query.trim() } });
      if (Array.isArray(results)) {
        return results.map((r: any) => this.mapContentToCatalogItem(r));
      }
    } catch (e) {
      console.warn('searchContent error:', e);
    }
    return [];
  }

  public static async getNewAndHot(): Promise<CatalogItem[]> {
    try {
      const results = await ApiClient.getApi('content/trending');
      if (Array.isArray(results)) {
        return results.map((r: any) => this.mapContentToCatalogItem(r));
      }
    } catch {}
    return [];
  }

  public static async getContentByCategory(categorySlugOrId: any): Promise<CatalogItem[]> {
    try {
      const res = await ApiClient.getApi(`categories/${encodeURIComponent(String(categorySlugOrId))}/content`);
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.content)
        ? res.content
        : Array.isArray(res)
        ? res
        : [];
      if (list.length > 0) {
        return list.map((r: any) => this.mapContentToCatalogItem(r));
      }
    } catch {}
    return [];
  }

  public static async getCategories(): Promise<CatalogCategory[]> {
    try {
      const result = await ApiClient.getApi('genres').catch(() => ApiClient.getApi('categories'));
      if (Array.isArray(result)) {
        return result.map((c: any) => ({
          id: c.id || 0,
          typeId: c.displayOrder || 1,
          name: c.name || '',
          image: AppConfig.normalizeMediaUrl(c.imageUrl || c.image),
        }));
      }
    } catch {}
    return [];
  }

  public static async getContentByLanguage(language: string | number): Promise<CatalogItem[]> {
    const raw = String(language ?? '').toLowerCase().trim();
    if (raw === 'all' || raw === 'all_indian' || raw === 'non-kannada' || raw === 'except-kannada') {
      return this.getContentNonKannada();
    }
    try {
      const modernRes = await ApiClient.getApi(`content/by-language/${encodeURIComponent(String(language))}`);
      const modernList = Array.isArray(modernRes?.data)
        ? modernRes.data
        : Array.isArray(modernRes?.content)
        ? modernRes.content
        : Array.isArray(modernRes)
        ? modernRes
        : [];
      return modernList.map((item: any) => this.mapContentToCatalogItem(item));
    } catch {
      return [];
    }
  }

  public static async getContentNonKannada(): Promise<CatalogItem[]> {
    try {
      const res = await ApiClient.getApi('content/non-kannada');
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.content)
        ? res.content
        : Array.isArray(res)
        ? res
        : [];
      return list.map((item: any) => this.mapContentToCatalogItem(item));
    } catch {
      return [];
    }
  }

  public static async getLanguages(): Promise<CatalogLanguage[]> {
    try {
      const result = await ApiClient.getApi('languages');
      if (Array.isArray(result) && result.length > 0) {
        return result.map((l: any) => ({
          id: l.id || l.code || 0,
          name: l.name || l.code || '',
          code: l.code || '',
          image: l.iconUrl || l.imageUrl || l.image || '',
        }));
      }
    } catch {}
    return [];
  }

  public static async getShortsList(): Promise<CatalogItem[]> {
    try {
      const results = await ApiClient.getApi('content/shorts');
      if (Array.isArray(results) && results.length > 0) {
        return results.map((r: any) => this.mapContentToCatalogItem(r));
      }
    } catch {}
    return [];
  }

  public static async getRentableContent(): Promise<CatalogItem[]> {
    try {
      const results = await ApiClient.getApi('tvod/products', {
        userToken: AuthService.authToken || undefined,
      });
      if (Array.isArray(results)) {
        return results
          .map((r: any) => this.mapContentToCatalogItem(r))
          .filter(
            (item) =>
              // Only show items that are actually rentable (have rental-specific fields)
              item.isRent === 1 ||
              item.is_rent === 1 ||
              item.rentBuy === 1 ||
              (item.rentPrice && item.rentPrice > 0) ||
              (item.rentDay && item.rentDay > 0) ||
              String((item as any).monetization || '').toUpperCase() === 'TVOD' ||
              String((item as any).rentType || '').toUpperCase() === 'RENT'
          );
      }
    } catch (e) {
      console.warn('tvod/products error:', e);
    }
    return [];
  }

  public static async getMyRentals(userId?: number): Promise<CatalogItem[]> {
    const uid = userId || AuthService.currentUser?.id;
    if (!uid) return [];
    try {
      const results = await ApiClient.getApi('tvod/purchases', {
        userToken: AuthService.authToken || undefined,
      });
      if (Array.isArray(results)) {
        return results.map((r: any) => this.mapContentToCatalogItem(r));
      }
    } catch (e) {
      console.warn('tvod/purchases error:', e);
    }
    return [];
  }

  private static mapContentToCatalogItem(content: any): CatalogItem {
    if (content && typeof content === 'object') {
      return parseCatalogItem(content);
    }
    return {
      id: 0,
      typeId: 1,
      videoType: 1,
      name: 'Untitled',
    };
  }
}
