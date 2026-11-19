declare const process: any;

export class AppConfig {
  private static _customBaseUrl?: string;

  public static get apiBaseUrl(): string {
    if (this._customBaseUrl) return this._customBaseUrl;

    if (typeof process !== 'undefined' && (process.env as any)?.API_BASE_URL) {
      return (process.env as any).API_BASE_URL;
    }

    return 'https://api.maxxpixels.com/api/v1';
  }

  public static get graphqlUrl(): string {
    if (typeof process !== 'undefined' && (process.env as any)?.GRAPHQL_URL) {
      return (process.env as any).GRAPHQL_URL;
    }
    const base = this.apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
    return `${base}/graphql`;
  }

  public static get authServiceUrl(): string {
    if (typeof process !== 'undefined' && (process.env as any)?.AUTH_SERVICE_URL) {
      return (process.env as any).AUTH_SERVICE_URL;
    }
    return this.apiBaseUrl;
  }

  public static setCustomBaseUrl(url: string) {
    const base = url.trim().replace(/\/+$/, '');
    this._customBaseUrl = !base ? undefined : base.endsWith('/api/v1') ? base : base.endsWith('/api') ? `${base}/v1` : `${base}/api/v1`;
  }

  static appName: string = 'Maxxpixels';
  static websiteUrl: string = 'https://maxxpixels.com';
  static termsUrl: string = 'https://maxxpixels.com/legal/terms-of-service';
  static privacyUrl: string = 'https://maxxpixels.com/legal/privacy-policy';
  static supportEmail: string = 'support@maxxpixels.com';
  static appShareUrl: string = 'https://play.google.com/store/apps/details?id=com.maxxpixels';

  /**
   * PlayforFun public API key (pk_...) — safe for client-side/frontend widget use.
   * Current integration uses a backend-signed SSO launch URL (PFF_SECRET stays on server);
   * this key is kept here per docs for frontend/widget identification when applicable.
   */
  static playForFunPublicKey: string = 'pk_b13e8b8d067d61963234';

  public static slugify(text: string): string {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public static getContentShareUrl(
    itemOrId: any,
    options?: {
      name?: string;
      slug?: string;
      videoType?: number;
      typeId?: number;
      isSeries?: boolean;
      referralCode?: string;
    }
  ): string {
    const item = typeof itemOrId === 'object' && itemOrId !== null ? itemOrId : undefined;
    const contentId = item?.id ?? item?.videoId ?? itemOrId;
    const cleanId = String(contentId ?? '').trim();

    const rawSlug = options?.slug || item?.slug || '';
    const name = options?.name || item?.name || item?.title || '';
    const slug = rawSlug || (name ? this.slugify(name) : '') || 'watch';

    const isSeries =
      options?.isSeries ??
      (options?.videoType === 2 ||
        item?.videoType === 2 ||
        options?.typeId === 2 ||
        options?.typeId === 6 ||
        item?.typeId === 2 ||
        item?.typeId === 6 ||
        String(item?.contentType || '').toUpperCase() === 'SERIES' ||
        String(item?.contentType || '').toUpperCase() === 'SHOW');

    const section = isSeries ? 'shows' : 'movies';
    const basePath = cleanId ? `${section}/${slug}/${cleanId}` : `${section}/${slug}`;
    const baseUrl = `${this.websiteUrl}/${basePath}`;

    const ref = options?.referralCode || item?.referralCode || item?.referenceCode;
    if (ref && String(ref).trim()) {
      return `${baseUrl}?ref=${encodeURIComponent(String(ref).trim())}`;
    }

    return baseUrl;
  }

  public static getWatchShareUrl(
    itemOrId: any,
    options?: {
      name?: string;
      slug?: string;
      videoType?: number;
      typeId?: number;
      isSeries?: boolean;
      episodeId?: number | string;
      referralCode?: string;
    }
  ): string {
    const item = typeof itemOrId === 'object' && itemOrId !== null ? itemOrId : undefined;
    const contentId = item?.id ?? item?.videoId ?? itemOrId;
    const cleanId = String(contentId ?? '').trim();

    const rawSlug = options?.slug || item?.slug || '';
    const name = options?.name || item?.name || item?.title || '';
    const slug = rawSlug || (name ? this.slugify(name) : '') || 'watch';

    const isSeries =
      options?.isSeries ??
      (options?.videoType === 2 ||
        item?.videoType === 2 ||
        options?.typeId === 2 ||
        options?.typeId === 6 ||
        item?.typeId === 2 ||
        item?.typeId === 6);

    const section = isSeries ? 'shows' : 'movies';
    const basePath = cleanId ? `${section}/${slug}/${cleanId}/watch` : `${section}/${slug}/watch`;
    const params = new URLSearchParams();
    if (options?.episodeId) params.set('ep', String(options.episodeId));
    const ref = options?.referralCode || item?.referralCode || item?.referenceCode;
    if (ref && String(ref).trim()) params.set('ref', String(ref).trim());
    const query = params.toString();

    return `${this.websiteUrl}/${basePath}${query ? `?${query}` : ''}`;
  }

  public static getShortShareUrl(shortId: number | string, referralCode?: string): string {
    const base = `${this.websiteUrl}/shorts/${shortId}`;
    return referralCode && referralCode.trim()
      ? `${base}?ref=${encodeURIComponent(referralCode.trim())}`
      : base;
  }

  public static getAppShareUrl(referralCode?: string): string {
    if (!referralCode || !referralCode.trim()) {
      return this.appShareUrl;
    }
    const clean = encodeURIComponent(referralCode.trim());
    return `${this.appShareUrl}&referrer=ref%3D${clean}`;
  }

  static normalizeMediaUrl(raw?: any, cacheBustKey?: string | number): string | undefined {
    const value = raw ? String(raw).trim() : '';
    if (!value) return undefined;

    try {
      let finalUrl = value;
      if (/^(file:|content:|data:|blob:)/i.test(value)) {
        return value;
      }

      if (value.startsWith('//')) {
        finalUrl = `https:${value}`;
      } else if (!/^https?:/i.test(value)) {
        const cleanPath = value.replace(/^\/+/, '');
        let origin = 'https://api.maxxpixels.com';
        try {
          const u = new URL(AppConfig.apiBaseUrl);
          origin = u.origin;
        } catch {
          const match = AppConfig.apiBaseUrl.match(/^(https?:\/\/[^\/]+)/i);
          if (match) origin = match[1];
        }
        // Preserve compatibility with legacy/local upload assets and relative media paths.
        // Backend media proxy streams the full image bytes from Bunny Storage.
        if (cleanPath.startsWith('uploads/') || cleanPath.startsWith('storage/')) {
          finalUrl = `${origin}/api/v1/uploads/${cleanPath.replace(/^uploads\//i, '').replace(/^storage\//i, '')}`;
        } else if (
          /^(posters|banners|branding|content|avatars|media|thumbnails|images|videos|notification|user)\//i.test(cleanPath) ||
          cleanPath.startsWith('banner_') ||
          /\.(?:png|jpe?g|webp|gif|svg|mp4|m3u8|mp3)$/i.test(cleanPath)
        ) {
          finalUrl = `${origin}/api/v1/uploads/${cleanPath.replace(/^uploads\//i, '')}`;
        } else {
          finalUrl = `${origin}/${cleanPath}`;
        }
      } else {
        // Bunny storage pull-zone URLs can be suspended/unconfigured (403). Route storage hosts
        // through the backend media proxy; leave Bunny Stream (vz-*) and HLS URLs untouched.
        const isStream = /(?:^|\/\/)vz-[^/]*\.b-cdn\.net/i.test(finalUrl) || /\.m3u8(?:$|[?#])/i.test(finalUrl);
        if (!isStream) {
          const storageCdnMatch = finalUrl.match(
            /^https?:\/\/(?:maxxpixels-images\.b-cdn\.net|cdn\.maxxpixels\.com)(?::\d+)?\/(.*)$/i,
          );
          if (storageCdnMatch?.[1]) {
            let origin = 'https://api.maxxpixels.com';
            try {
              origin = new URL(AppConfig.apiBaseUrl).origin;
            } catch {}
            const rel = storageCdnMatch[1]
              .replace(/^\/+/, '')
              .replace(/^api\/v1\/uploads\//i, '')
              .replace(/^uploads\//i, '');
            finalUrl = `${origin}/api/v1/uploads/${rel}`;
          }
        }

        // Normalize common internal/backend upload URLs to public API upload URLs as a safe fallback.
        const internalUpload = finalUrl.match(
          /^https?:\/\/(?:localhost|127\.0\.0\.1|backend(?:-web)?|maxxpixels-production-backend-web-1|admin\.maxxpixels\.com)(?::\d+)?\/(?:api\/v1\/)?(?:uploads\/|storage\/)?(.*)$/i,
        );
        if (internalUpload?.[1]) {
          let origin = 'https://api.maxxpixels.com';
          try {
            origin = new URL(AppConfig.apiBaseUrl).origin;
          } catch {}
          finalUrl = `${origin}/api/v1/uploads/${internalUpload[1].replace(/^\/+/, '').replace(/^uploads\//i, '')}`;
        }
      }

      if (cacheBustKey && /^https?:\/\//i.test(finalUrl)) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${separator}v=${encodeURIComponent(String(cacheBustKey))}`;
      }

      return finalUrl;
    } catch {
      return value;
    }
  }
}
