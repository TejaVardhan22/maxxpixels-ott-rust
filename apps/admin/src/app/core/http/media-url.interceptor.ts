import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { resolveAdminImageUrl } from '../services/movie-api.service';

/**
 * Rewrites Bunny storage pull-zone media URLs in API payloads to the backend media proxy.
 *
 * The storage pull zone (maxxpixels-images.b-cdn.net) currently answers 403 while it is
 * suspended/unconfigured, and relative `/uploads/...` paths 404 on the admin domain.
 * Doing this centrally keeps every admin screen (movies, series, CMS, ads, users,
 * producer portal, reports) working without touching each template.
 */
const MEDIA_HOST_RE =
  /^(?:https?:)?\/\/(?:[a-z0-9-]+\.b-cdn\.net|cdn\.maxxpixels\.com)\//i;

const STREAM_RE = /^(?:https?:)?\/\/(?:vz-|video\.bunnycdn\.com)/i;

function rewriteMediaValue(value: string): string {
  if (!MEDIA_HOST_RE.test(value)) return value;
  // Bunny Stream hosts and HLS manifests are served directly and must not be rewritten.
  if (STREAM_RE.test(value) || /\.m3u8(?:$|[?#])/i.test(value)) return value;
  return resolveAdminImageUrl(value) || value;
}

function rewriteMediaUrls(node: any, depth = 0): any {
  if (node == null || depth > 10) return node;
  if (typeof node === 'string') return rewriteMediaValue(node);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) node[i] = rewriteMediaUrls(node[i], depth + 1);
    return node;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) node[key] = rewriteMediaUrls(node[key], depth + 1);
    return node;
  }
  return node;
}

export const mediaUrlInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body && typeof event.body === 'object') {
        try {
          return event.clone({ body: rewriteMediaUrls(event.body) });
        } catch {
          return event;
        }
      }
      return event;
    }),
  );
