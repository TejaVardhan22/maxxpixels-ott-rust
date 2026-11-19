import { getApiClient } from './client';
import { getApiConfigOrNull } from '../config';
import { resolveAdPosterUrlOptional } from '../utils/image';

// ── Types ────────────────────────────────────────────────────────────────

export interface AdEntry {
  placement_id?: number;
  ad_id: number | string;
  video_url: string;      // resolved playable URL (filled after resolveVastTag)
  tag_url?: string;       // VAST/VMAP tag when the creative is tag-based
  thumbnail: string | null;
  duration: number;       // seconds
  skip_after: number | null; // null = unskippable
  title: string;
  time_markers?: number[]; // only for mid_roll
  impression_urls?: string[];
  click_through_url?: string;
  click_tracking_urls?: string[];
}

export interface AdQueue {
  pre_roll: AdEntry[];
  mid_roll: AdEntry[];
  post_roll: AdEntry[];
}

export interface AdContext {
  video_id: number;
  device?: 'mobile' | 'tablet' | 'tv' | 'web';
  country?: string;       // ISO-2
  age_range?: string;     // '18-24' | '25-34' | '35-44' | '45-54' | '55+'
  category?: string;
  user_id?: number;
}

export interface RecordImpressionParams {
  ad_id: number;
  placement_id?: number;
  video_id?: number;
  watch_time: number;     // seconds watched
  session_id: string;     // client UUID, used for dedup
  device_type?: string;
  country_code?: string;
  age_range?: string;
  user_id?: number;
}

/** First deduped click per session_id + ad_id (see tbl_ad_clicks). */
export interface RecordAdClickParams {
  ad_id: number | string;
  session_id: string;
  placement_id?: number;
  video_id?: number;
  destination_url?: string;
  user_id?: number;
  device_type?: string;
}

// ── Ad Serving API ────────────────────────────────────────────────────────

export const adApi = {
  /**
   * Fetch the ad queue for a video from the NestJS VAST pipeline
   * (GET ads/queue — wraps getAdConfigForContent: 1000-unique gate, GAM tag,
   * cue points). Entries carry `tag_url` VAST tags; resolve them with
   * resolveVastTag before playback.
   */
  async getAds(ctx: AdContext): Promise<AdQueue & { session_id?: string; fallback_vast_url?: string }> {
    const params = new URLSearchParams({
      video_id: String(ctx.video_id),
      device: ctx.device ?? 'web',
    });

    let payload: any = null;
    try {
      const res = await getApiClient().get<any>(`ads/queue?${params.toString()}`);
      payload = res?.data ?? res;
    } catch {
      return { pre_roll: [], mid_roll: [], post_roll: [] };
    }

    if (!payload?.enabled) {
      return { pre_roll: [], mid_roll: [], post_roll: [] };
    }

    const mapEntry = (entry: any): AdEntry => ({
      placement_id: Number(entry?.placement_id ?? 0) || 0,
      ad_id: entry?.id ?? entry?.ad_id ?? '',
      video_url: '',
      tag_url: entry?.tag_url || entry?.tagUrl || payload.fallback_vast_url || undefined,
      thumbnail: entry?.thumbnail ?? null,
      duration: Number(entry?.duration ?? 0) || 30,
      skip_after:
        entry?.skip_after === null || entry?.skip_after === undefined
          ? 5
          : Number(entry.skip_after),
      title: entry?.title || 'Sponsored',
      time_markers: Array.isArray(entry?.time_markers)
        ? entry.time_markers
        : entry?.time_offset !== undefined
        ? [Number(entry.time_offset)]
        : undefined,
    });

    return {
      session_id: payload.session_id,
      fallback_vast_url: payload.fallback_vast_url,
      pre_roll: (payload.pre_roll ?? []).map(mapEntry),
      mid_roll: (payload.mid_roll ?? []).map(mapEntry),
      post_roll: (payload.post_roll ?? []).map(mapEntry),
    };
  },

  /**
   * Resolve a VAST/VMAP ad tag into a directly playable media URL plus its
   * tracking beacons (client-side IMA is not used on web).
   */
  async resolveVastTag(tagUrl: string): Promise<{
    mediaUrl: string;
    title?: string;
    clickThroughUrl?: string;
    clickTrackingUrls?: string[];
    impressionUrls?: string[];
  } | null> {
    if (!tagUrl || !/^https?:\/\//i.test(tagUrl)) return null;
    try {
      const res = await fetch(tagUrl, { headers: { Accept: 'application/xml, text/xml, */*' } });
      if (!res.ok) return null;
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, 'text/xml');

      // Works for both VAST (<MediaFile>) and VMAP (<VASTAdData> nested VAST).
      const mediaFiles = Array.from(doc.getElementsByTagName('MediaFile'));
      if (mediaFiles.length === 0) return null;

      const pick = mediaFiles
        .map((node) => ({
          node,
          bitrate: Number(node.getAttribute('bitrate') || 0),
          width: Number(node.getAttribute('width') || 0),
          delivery: (node.getAttribute('delivery') || '').toLowerCase(),
        }))
        .sort((a, b) => {
          // Prefer progressive mp4, then highest quality.
          const mp4 = (x: typeof a) => (x.delivery === 'progressive' && /mp4/i.test(x.node.textContent || '') ? 1 : 0);
          return mp4(b) - mp4(a) || b.bitrate - a.bitrate || b.width - a.width;
        })[0];

      const mediaUrl = (pick.node.textContent || '').trim();
      if (!/^https?:\/\//i.test(mediaUrl)) return null;

      const urls = (tag: string): string[] =>
        Array.from(doc.getElementsByTagName(tag))
          .map((n) => (n.textContent || '').trim())
          .filter((u) => /^https?:\/\//i.test(u));

      const titleNode = doc.querySelector('AdTitle, AdSystem');
      const clickThroughNode = doc.querySelector('ClickThrough');

      return {
        mediaUrl,
        title: titleNode?.textContent || undefined,
        clickThroughUrl: clickThroughNode?.textContent?.trim() || undefined,
        clickTrackingUrls: urls('ClickTracking'),
        impressionUrls: urls('Impression'),
      };
    } catch {
      return null;
    }
  },

  /**
   * Report ad playback to the server pipeline (POST ads/track) so it lands in
   * `ad_events` — this is what powers the producer panel's Ads Run counter,
   * roll split (pre/mid/post) and ad revenue.
   */
  async trackEvent(params: {
    ad_id: number | string;
    video_id: number | string;
    eventType: 'REQUEST' | 'IMPRESSION' | 'START' | 'COMPLETE' | 'SKIP' | 'CLICK';
    sessionToken: string;
    providerCode?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const numeric = Number(params.ad_id);
    const campaignId = Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
    try {
      await getApiClient().post('ads/track', {
        ad_id: campaignId,
        campaignId,
        video_id: params.video_id,
        content_id: params.video_id,
        contentId: params.video_id,
        sessionToken: params.sessionToken,
        session_id: params.sessionToken,
        providerCode: params.providerCode || 'DIRECT',
        eventType: params.eventType,
        metadata: params.metadata,
      });
    } catch {
      /* Ad analytics must never interrupt playback. */
    }
  },

  /**
   * @deprecated legacy endpoint no longer served by the backend — use trackEvent.
   */
  async recordImpression(params: RecordImpressionParams): Promise<void> {
    await adApi.trackEvent({
      ad_id: params.ad_id,
      video_id: params.video_id ?? 0,
      eventType: 'IMPRESSION',
      sessionToken: params.session_id,
      metadata: { device: params.device_type, watchTime: params.watch_time },
    });
  },

  /**
   * Record a CTA tap (deduped server-side per session + ad).
   */
  async recordClick(params: RecordAdClickParams): Promise<void> {
    await getApiClient().post('record_ad_click', params);
  },
};

function normalizeAdEntries(entries: AdEntry[] = []): AdEntry[] {
  let serverOrigin = '';
  try {
    const config = getApiConfigOrNull?.();
    const base = config?.baseUrl || '';
    if (base.startsWith('http')) {
      serverOrigin = new URL(base).origin;
    }
  } catch {}

  return entries.map((entry) => {
    let videoUrl = (entry.video_url || '').trim();
    if (videoUrl.startsWith('/uploads/') && serverOrigin) {
      videoUrl = `${serverOrigin}${videoUrl}`;
    }
    return {
      ...entry,
      video_url: videoUrl,
      thumbnail: resolveAdPosterUrlOptional(entry.thumbnail),
    };
  });
}

/** Resolves tag-based entries into directly playable media URLs in place. */
async function resolveTaggedEntries(entries: AdEntry[]): Promise<AdEntry[]> {
  const out: AdEntry[] = [];
  for (const entry of entries) {
    if (entry.video_url || !entry.tag_url) {
      out.push(entry);
      continue;
    }
    try {
      const resolved = await adApi.resolveVastTag(entry.tag_url);
      if (!resolved) continue; // tag unresolvable — drop the slot rather than stall playback
      out.push({
        ...entry,
        video_url: resolved.mediaUrl,
        title: resolved.title || entry.title,
        click_through_url: resolved.clickThroughUrl || entry.click_through_url,
        click_tracking_urls: resolved.clickTrackingUrls?.length
          ? resolved.clickTrackingUrls
          : entry.click_tracking_urls,
        impression_urls: resolved.impressionUrls?.length
          ? resolved.impressionUrls
          : entry.impression_urls,
      });
    } catch {
      continue;
    }
  }
  return out;
}

export { normalizeAdEntries, resolveTaggedEntries };
