/**
 * InMobi & IAB VAST 2.0 / 3.0 / 4.x Parser and Beacon Tracking Service
 *
 * Resolves VAST tags (including InMobi VAST, Google Ad Manager, and Direct VAST)
 * into playable video media files (MP4 / HLS) and manages tracking beacons.
 */

export interface VastTrackingEvents {
  start?: string[];
  firstQuartile?: string[];
  midpoint?: string[];
  thirdQuartile?: string[];
  complete?: string[];
  skip?: string[];
  mute?: string[];
  unmute?: string[];
  pause?: string[];
  resume?: string[];
}

export interface ResolvedVastAd {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType: string;
  durationSeconds: number;
  skipOffsetSeconds: number | null;
  clickThroughUrl?: string;
  clickTrackingUrls: string[];
  impressionUrls: string[];
  trackingEvents: VastTrackingEvents;
  rawVastXml?: string;
}

export class VastService {
  public static readonly INMOBI_ACCOUNT_ID = 'b0e3f3a3b99e4ed7b9a82cd25cc59481';
  public static readonly INMOBI_SITE_ID = '8839a620596f46169ed937f1568740db';
  private static readonly MAX_WRAPPER_DEPTH = 5;

  /**
   * Generates a standard InMobi Video VAST tag URL using the publisher's InMobi site ID & account ID.
   */
  public static buildInMobiVastTagUrl(params?: {
    placementId?: string;
    contentId?: string | number;
    siteId?: string;
    accountId?: string;
    width?: number;
    height?: number;
  }): string {
    const siteId = params?.siteId || this.INMOBI_SITE_ID;
    const accountId = params?.accountId || this.INMOBI_ACCOUNT_ID;
    const placementId = params?.placementId || '1730000000001';
    const cid = params?.contentId || '0';
    const w = params?.width || 1920;
    const h = params?.height || 1080;
    const ts = Date.now();

    return `https://ad.inmobi.com/ad.jsp?mk-siteid=${siteId}&account_id=${accountId}&placement=${placementId}&format=vast&v=4.2&w=${w}&h=${h}&content_id=${cid}&cb=${ts}`;
  }

  /**
   * Resolves a VAST tag URL into a playable video ad with all tracking metadata.
   * Recursively resolves VAST wrappers if encountered.
   */
  public static async resolveVastUrl(
    tagUrl: string,
    depth = 0,
  ): Promise<ResolvedVastAd | null> {
    if (!tagUrl || !/^https?:\/\//i.test(tagUrl) || depth > this.MAX_WRAPPER_DEPTH) {
      return null;
    }

    try {
      const response = await fetch(tagUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/xml, text/xml, */*',
          'User-Agent': 'MaxxPixels/1.0 (Android; Mobile)',
        },
      });

      if (!response.ok) {
        console.warn(`[VastService] HTTP error ${response.status} fetching VAST: ${tagUrl}`);
        return null;
      }

      const xmlText = await response.text();
      return this.parseVastXml(xmlText, depth, tagUrl);
    } catch (err: any) {
      console.warn(`[VastService] Failed to fetch or resolve VAST tag (${tagUrl}):`, err.message);
      return null;
    }
  }

  /**
   * Parses raw VAST XML content and extracts structured ad parameters and beacons.
   */
  public static async parseVastXml(
    xml: string,
    depth = 0,
    parentUrl?: string,
  ): Promise<ResolvedVastAd | null> {
    if (!xml || typeof xml !== 'string') return null;

    // Check if this is a VAST Wrapper referencing another VAST tag
    const wrapperMatch = xml.match(/<VASTAdTagURI[^>]*>([\s\S]*?)<\/VASTAdTagURI>/i);
    if (wrapperMatch && wrapperMatch[1]) {
      const wrappedUrl = this.cleanCdata(wrapperMatch[1].trim());
      if (wrappedUrl && wrappedUrl !== parentUrl && depth < this.MAX_WRAPPER_DEPTH) {
        console.log(`[VastService] Following VAST wrapper (depth=${depth + 1}) -> ${wrappedUrl}`);
        const resolved = await this.resolveVastUrl(wrappedUrl, depth + 1);
        if (resolved) {
          // Merge wrapper impressions and tracking events with wrapped ad
          const wrapperImpressions = this.extractMultipleTags(xml, 'Impression');
          resolved.impressionUrls.push(...wrapperImpressions);

          const wrapperClickTracking = this.extractMultipleTags(xml, 'ClickTracking');
          resolved.clickTrackingUrls.push(...wrapperClickTracking);

          const wrapperEvents = this.extractTrackingEvents(xml);
          for (const [key, list] of Object.entries(wrapperEvents)) {
            const eventKey = key as keyof VastTrackingEvents;
            resolved.trackingEvents[eventKey] = [
              ...(resolved.trackingEvents[eventKey] || []),
              ...(list || []),
            ];
          }
          return resolved;
        }
      }
    }

    // Extract Media Files
    const mediaFiles = this.extractMediaFiles(xml);
    if (mediaFiles.length === 0) {
      console.log('[VastService] No valid media files found in VAST response.');
      return null;
    }

    // Pick best playable video (prefer mp4 or m3u8)
    const selectedMedia =
      mediaFiles.find(
        (m) =>
          /mp4/i.test(m.type) ||
          /mpegURL/i.test(m.type) ||
          /\.(mp4|m3u8)(\?|$)/i.test(m.url),
      ) || mediaFiles[0];

    // Extract Metadata
    const adIdMatch = xml.match(/<Ad\s+[^>]*id=["']([^"']+)["']/i);
    const id = adIdMatch ? adIdMatch[1] : `inmobi-vast-${Date.now()}`;

    const titleMatch = xml.match(/<AdTitle[^>]*>([\s\S]*?)<\/AdTitle>/i);
    const title = titleMatch ? this.cleanCdata(titleMatch[1].trim()) : 'Sponsored Video';

    // Extract Duration & SkipOffset
    const durationMatch = xml.match(/<Duration[^>]*>([\s\S]*?)<\/Duration>/i);
    const durationSeconds = durationMatch
      ? this.parseDurationToSeconds(this.cleanCdata(durationMatch[1].trim()))
      : 15;

    let skipOffsetSeconds: number | null = 5;
    const skipMatch = xml.match(/skipoffset=["']([^"']+)["']/i);
    if (skipMatch && skipMatch[1]) {
      skipOffsetSeconds = this.parseDurationToSeconds(skipMatch[1].trim(), durationSeconds);
    }

    // Extract Tracking Beacons & Click URLs
    const impressionUrls = this.extractMultipleTags(xml, 'Impression');
    const clickThroughMatch = xml.match(/<ClickThrough[^>]*>([\s\S]*?)<\/ClickThrough>/i);
    const clickThroughUrl = clickThroughMatch
      ? this.cleanCdata(clickThroughMatch[1].trim())
      : undefined;

    const clickTrackingUrls = this.extractMultipleTags(xml, 'ClickTracking');
    const trackingEvents = this.extractTrackingEvents(xml);

    return {
      id,
      title,
      mediaUrl: selectedMedia.url,
      mediaType: selectedMedia.type,
      durationSeconds,
      skipOffsetSeconds,
      clickThroughUrl,
      clickTrackingUrls,
      impressionUrls,
      trackingEvents,
      rawVastXml: xml,
    };
  }

  /**
   * Fires tracking beacon URLs with macro substitution (e.g. [TIMESTAMP], [CACHEBUSTING]).
   * Fire-and-forget: network errors are caught silently so ad playback is never blocked.
   */
  public static fireBeacons(urls?: string[]): void {
    if (!Array.isArray(urls) || urls.length === 0) return;

    urls.forEach((rawUrl) => {
      if (!rawUrl || typeof rawUrl !== 'string') return;
      const ts = String(Date.now());
      const cleanUrl = rawUrl
        .replace(/\[TIMESTAMP\]/gi, ts)
        .replace(/\[CACHEBUSTING\]/gi, ts)
        .replace(/%%CACHEBUSTER%%/gi, ts);

      if (!/^https?:\/\//i.test(cleanUrl)) return;

      try {
        fetch(cleanUrl, {
          method: 'GET',
          mode: 'no-cors',
          headers: { 'User-Agent': 'MaxxPixels/1.0 (Android; Mobile)' },
        }).catch(() => {});
      } catch {}
    });
  }

  private static cleanCdata(text: string): string {
    return text
      .replace(/^<!\[CDATA\[/i, '')
      .replace(/\]\]>$/i, '')
      .trim();
  }

  private static parseDurationToSeconds(timeStr: string, totalDuration = 15): number {
    if (!timeStr) return 15;
    if (timeStr.endsWith('%')) {
      const pct = parseFloat(timeStr) / 100;
      return Math.round(totalDuration * Math.min(1, Math.max(0, pct)));
    }
    const parts = timeStr.split(':').map((p) => parseFloat(p));
    if (parts.length === 3) {
      return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    if (parts.length === 2) {
      return Math.round(parts[0] * 60 + parts[1]);
    }
    const num = parseFloat(timeStr);
    return isNaN(num) ? 15 : Math.round(num);
  }

  private static extractMultipleTags(xml: string, tagName: string): string[] {
    const results: string[] = [];
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      const val = this.cleanCdata(match[1]);
      if (val && /^https?:\/\//i.test(val)) {
        results.push(val);
      }
    }
    return results;
  }

  private static extractTrackingEvents(xml: string): VastTrackingEvents {
    const events: VastTrackingEvents = {};
    const regex = /<Tracking\s+[^>]*event=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Tracking>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      const eventName = match[1].toLowerCase().trim() as keyof VastTrackingEvents;
      const url = this.cleanCdata(match[2]);
      if (url && /^https?:\/\//i.test(url)) {
        if (!events[eventName]) {
          events[eventName] = [];
        }
        events[eventName]!.push(url);
      }
    }
    return events;
  }

  private static extractMediaFiles(
    xml: string,
  ): Array<{ url: string; type: string; width: number; height: number }> {
    const files: Array<{ url: string; type: string; width: number; height: number }> = [];
    const regex = /<MediaFile([^>]*)>([\s\S]*?)<\/MediaFile>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      const attrs = match[1];
      const rawUrl = this.cleanCdata(match[2]);
      if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) continue;

      const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
      const widthMatch = attrs.match(/width=["']([^"']+)["']/i);
      const heightMatch = attrs.match(/height=["']([^"']+)["']/i);

      files.push({
        url: rawUrl,
        type: typeMatch ? typeMatch[1] : 'video/mp4',
        width: widthMatch ? parseInt(widthMatch[1], 10) : 1920,
        height: heightMatch ? parseInt(heightMatch[1], 10) : 1080,
      });
    }
    return files;
  }
}

