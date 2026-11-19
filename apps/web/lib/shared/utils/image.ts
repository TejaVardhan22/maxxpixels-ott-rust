
function normalizeRelativeAssetPath(path: string): string {
  const isLeadingSlash = path.startsWith('/');
  const trimmed = path.replace(/^\/+/, '');
  if (!trimmed) return '';

  // Backend-served media -> backend media proxy (streams full bytes from Bunny Storage).
  if (
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('storage/') ||
    trimmed.startsWith('content/') ||
    trimmed.startsWith('posters/') ||
    trimmed.startsWith('banners/') ||
    trimmed.startsWith('branding/') ||
    trimmed.startsWith('notification/') ||
    trimmed.startsWith('user/')
  ) {
    const rel = trimmed.replace(/^uploads\//i, '').replace(/^storage\//i, '');
    return `/api/v1/uploads/${rel}`;
  }

  // Local public assets shipped with the web app.
  if (
    trimmed.startsWith('assets/') ||
    trimmed.startsWith('demo/') ||
    trimmed.startsWith('banner_') ||
    trimmed.startsWith('logo.') ||
    trimmed.startsWith('icon.') ||
    trimmed.endsWith('.svg') ||
    isLeadingSlash
  ) {
    return `/${trimmed}`;
  }

  return `/api/v1/uploads/${trimmed}`;
}

function normalizeExternalAssetUrl(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const isInternalBackend =
      ['backend', 'backend-web', 'maxxpixels-production-backend-web-1'].includes(url.hostname) ||
      ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        ['8000', '8080'].includes(url.port));
    const isPublicSiteOverHttp =
      url.protocol === 'http:' &&
      ['maxxpixels.com', 'www.maxxpixels.com'].includes(url.hostname);
    const isBackendAssetPath =
      url.pathname.startsWith('/api/media/') ||
      url.pathname.startsWith('/uploads/') ||
      url.pathname.startsWith('/storage/') ||
      url.pathname.startsWith('/content/') ||
      url.pathname.startsWith('/posters/') ||
      url.pathname.startsWith('/banners/') ||
      url.pathname.startsWith('/assets/');
    if (isBackendAssetPath && (isInternalBackend || isPublicSiteOverHttp)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // not an absolute URL, continue normal heuristics
  }
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^(https?|blob:|data:)/i.test(trimmed)) return trimmed;
  const embeddedCdnUrl = trimmed.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (embeddedCdnUrl) {
    const withProtocol = `https://${embeddedCdnUrl}`;
    if (trimmed.includes('https://')) return trimmed;
    return withProtocol;
  }
  const embeddedZataUrl = trimmed.match(/(?:^|\/)([a-z0-9.-]+\.zata\.ai\/.+)$/i)?.[1];
  if (embeddedZataUrl) return `https://${embeddedZataUrl}`;
  const embeddedHttpUrl = trimmed.match(/(?:^|\/)(https?:\/\/.+)$/i)?.[1];
  if (embeddedHttpUrl) return embeddedHttpUrl;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function dataUriPlaceholder(label: string): string {
  const initial = (label ?? '?').charAt(0).toUpperCase();
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960" role="img" aria-label="${initial}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#151515"/>
          <stop offset="100%" stop-color="#2a2a2a"/>
        </linearGradient>
      </defs>
      <rect width="640" height="960" fill="url(#g)"/>
      <circle cx="320" cy="360" r="138" fill="#ffb800" fill-opacity="0.16"/>
      <text x="320" y="400" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="180" font-weight="700" fill="#ffffff">${initial}</text>
    </svg>
  `.trim());
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

function isExternalPlaceholder(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === 'placehold.co' ||
      host.endsWith('.placehold.co') ||
      host === 'via.placeholder.com' ||
      host.endsWith('.via.placeholder.com') ||
      host === 'picsum.photos' ||
      host.endsWith('.picsum.photos') ||
      host === 'i.picsum.photos' ||
      host.endsWith('.i.picsum.photos')
    );
  } catch {
    return false;
  }
}

export function resolveImageUrl(path?: string | null): string {
  if (!path) return '';
  const trimmed = path.trim();
  if (/(?:^|\/)(?:no[_-]?img|no[_-]?image|placeholder)\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(trimmed)) {
    return '';
  }

  // 1. Data URIs and Blob URIs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. Bunny storage pull-zone URLs: route through the backend media proxy which streams the
  //    full image bytes (the pull zone itself may be suspended and return 403).
  //    Bunny Stream hosts (vz-*.b-cdn.net) and HLS manifests are left untouched.
  const absolute = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  const isBunnyStream = /(?:^|\/\/)vz-[^/]*\.b-cdn\.net/i.test(absolute) || /\.m3u8(?:$|[?#])/i.test(absolute);
  if (!isBunnyStream && (absolute.includes('.b-cdn.net') || absolute.includes('bunnycdn.com'))) {
    try {
      const parsed = new URL(absolute);
      const rel = parsed.pathname
        .replace(/^\/+/, '')
        .replace(/^api\/v1\/uploads\//i, '')
        .replace(/^uploads\//i, '')
        .replace(/^storage\//i, '');
      if (rel) return `/api/v1/uploads/${rel}`;
    } catch {}
    if (!absolute.startsWith('http://') && !absolute.startsWith('https://')) {
      return `https://${absolute}`;
    }
    return absolute;
  }

  // 3. Known external image services
  if (
    trimmed.includes('images.unsplash.com') ||
    trimmed.includes('picsum.photos') ||
    trimmed.includes('pravatar.cc') ||
    trimmed.includes('ui-avatars.com')
  ) {
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  // 4. Other active cloud/CDN pull zones
  if (trimmed.includes('zata.ai')) {
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  // 5. Relative paths (/uploads/..., /posters/..., /banners/..., etc.)
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('storage/') ||
    trimmed.startsWith('posters/') ||
    trimmed.startsWith('banners/') ||
    trimmed.startsWith('branding/') ||
    trimmed.startsWith('content/') ||
    trimmed.startsWith('assets/')
  ) {
    return normalizeRelativeAssetPath(trimmed);
  }

  // 6. Normalize other external URLs
  const externalUrl = normalizeExternalAssetUrl(trimmed);
  if (externalUrl) {
    if (isExternalPlaceholder(externalUrl)) {
      const match = externalUrl.match(/[?&]text=([^&]+)/i);
      const label = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'P';
      return dataUriPlaceholder(label);
    }
    return externalUrl;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return normalizeRelativeAssetPath(trimmed);
}

/** Resolve a list of backend image URLs, removing empty/duplicate values. */
export function resolveImageCandidates(paths?: Array<string | null | undefined>): string[] {
  if (!paths?.length) return [];
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const path of paths) {
    const url = resolveImageUrl(path);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    resolved.push(url);
  }
  return resolved;
}

export function posterFallback(name?: string): string {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900" role="img" aria-label="${initial}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#151515"/>
          <stop offset="100%" stop-color="#2a2a2a"/>
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)"/>
      <circle cx="300" cy="330" r="132" fill="#ffb800" fill-opacity="0.14"/>
      <text x="300" y="370" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="180" font-weight="700" fill="#ffffff">${initial}</text>
    </svg>
  `.trim());
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

/** Returns a playable poster image URL, or null when the ad has no poster asset. */
export function resolveAdPosterUrlOptional(path?: string | null): string | null {
  const value = (path ?? '').trim();
  if (!value) return null;

  if (/\.(m3u8|mp4|m4v|mov|webm|ts)(?:[?#].*)?$/i.test(value)) {
    return null;
  }

  return resolveImageUrl(value) || null;
}

export function resolveAdPosterUrl(path?: string | null, title?: string | null): string {
  return resolveAdPosterUrlOptional(path) ?? posterFallback(title || 'AD');
}

export function avatarUrl(image?: string | null): string {
  return resolveImageUrl(image) || posterFallback('U');
}
