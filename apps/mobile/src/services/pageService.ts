import { AdminPage } from '../types';
import { ApiClient } from './apiClient';

export class PageService {
  public static async getPages(): Promise<AdminPage[]> {
    try {
      const response = await ApiClient.getApi('legal');
      const legalPages = Array.isArray(response) ? response : [];
      const pages: AdminPage[] = legalPages.map((page: any, index: number) => ({
        id: Number(page.id) || 101 + index,
        title: page.title,
        subtitle: 'Official MaxxPixels policy and compliance information',
        description: page.content || '',
      })).filter((page: AdminPage) => Boolean(page.title));

      if (pages.length > 0) {
        return pages;
      }
    } catch {}

    return this.fallbackLegalPages();
  }

  public static fallbackLegalPages(): AdminPage[] { return []; }
}
