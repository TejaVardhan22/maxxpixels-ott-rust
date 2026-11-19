export interface PlaybackAd {
  key: string;
  id: string;
  url: string;
  tagUrl?: string;
  isVast?: boolean;
  skipAfter: number | null;
  at: number;
  placement: 'pre' | 'mid' | 'post';
  title?: string;
  clickThroughUrl?: string;
  clickTrackingUrls?: string[];
  impressionUrls?: string[];
  trackingEvents?: {
    start?: string[];
    firstQuartile?: string[];
    midpoint?: string[];
    thirdQuartile?: string[];
    complete?: string[];
    skip?: string[];
  };
}

export function parseAdQueue(
  queue: any,
  normalize: (url: string) => string,
): PlaybackAd[] {
  const result: PlaybackAd[] = [];
  if (!queue || typeof queue !== 'object') return result;

  const fieldPlacements = [
    { fields: ['pre_roll', 'preroll', 'preRoll', 'pre'], placement: 'pre' as const },
    { fields: ['mid_roll', 'midroll', 'midRoll', 'mid'], placement: 'mid' as const },
    { fields: ['post_roll', 'postroll', 'postRoll', 'post'], placement: 'post' as const },
  ];

  for (const { fields, placement } of fieldPlacements) {
    let adList: any[] = [];
    for (const f of fields) {
      if (Array.isArray(queue[f])) {
        adList = queue[f];
        break;
      }
    }
    if (!Array.isArray(adList) || adList.length === 0) continue;

    adList.forEach((ad: any, index: number) => {
      const rawUrl =
        ad?.video_url ||
        ad?.videoUrl ||
        ad?.stream_url ||
        ad?.streamUrl ||
        ad?.tag_url ||
        ad?.tagUrl ||
        ad?.url ||
        ad?.media_url;
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) return;
      const url = normalize(rawUrl);
      if (!/^https?:\/\//i.test(url)) return;

      let markers: number[] = [];
      if (placement === 'mid') {
        const rawMarkers =
          ad.time_markers ||
          ad.timeMarkers ||
          ad.cue_points ||
          ad.cuePoints ||
          [120, 300, 600, 900];
        markers = (Array.isArray(rawMarkers) ? rawMarkers : [120, 300, 600, 900])
          .filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0);
      } else {
        markers = [placement === 'pre' ? 0 : Infinity];
      }

      markers.forEach((at: number, markerIndex: number) => {
        if (placement === 'mid' && (!Number.isFinite(at) || at <= 0)) return;
        const skipSec =
          ad.skip_after === null || ad.skipAfter === null
            ? null
            : typeof ad.skip_after === 'number'
            ? ad.skip_after
            : typeof ad.skipAfter === 'number'
            ? ad.skipAfter
            : 5;
        const isVast = Boolean(ad?.tag_url || ad?.tagUrl || /vast|vmap|gampad|inmobi/i.test(url));
        const tagUrl = ad?.tag_url || ad?.tagUrl || (isVast ? url : undefined);
        result.push({
          key: `${placement}-${index}-${markerIndex}`,
          id: String(ad.ad_id ?? ad.id ?? `${placement}-${index}`),
          url,
          tagUrl,
          isVast,
          at,
          placement,
          title: ad?.title || ad?.name || 'Advertisement',
          skipAfter: skipSec !== null && Number.isFinite(skipSec) && skipSec >= 0 ? skipSec : null,
        });
      });
    });
  }
  return result.sort((a, b) => a.at - b.at);
}

export function nextAd(
  ads: PlaybackAd[],
  played: Set<string>,
  time: number,
  ended = false,
): PlaybackAd | undefined {
  return ads.find(
    ad =>
      !played.has(ad.key) && (ad.placement === 'post' ? ended : ad.at <= time),
  );
}
