/**
 * Configuration & Constants for Video Advertising Module
 */

export const GOOGLE_IMA_SDK_URL = 'https://imasdk.googleapis.com/js/sdk3/google_ima3.js';

/**
 * Official Google IMA Test VMAP & VAST tags for development and testing.
 * VMAP tags contain pre-roll, mid-roll, and post-roll ad break declarations.
 */
export const SAMPLE_AD_TAGS = {
  /** Single Inline Linear Pre-roll */
  SINGLE_PREROLL:
    'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&type=js&correlator=',

  /** VMAP Pre-roll + Mid-roll (10s) + Post-roll */
  VMAP_STANDARD:
    'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/vmap_ad_samples&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&env=vp&output=vmap&unviewed_position_start=1&type=js&cmsid=2547631&vid=short_one&correlator=',

  /** Skippable 15s Pre-roll */
  SKIPPABLE_PREROLL:
    'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&type=js&correlator=',
};

export const AD_CONFIG_DEFAULTS = {
  adTimeoutMs: 8000,
  linearAdSlotWidth: 640,
  linearAdSlotHeight: 360,
};

export function isVideoAdsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return process.env.NEXT_PUBLIC_VIDEO_ADS_ENABLED === 'true';
}

export function isGoogleAdManagerEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return process.env.NEXT_PUBLIC_GOOGLE_AD_MANAGER_ENABLED === 'true';
}

export function isAdDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return process.env.NEXT_PUBLIC_VIDEO_ADS_DEBUG === 'true';
}

export function getDefaultAdTagUrl(): string {
  if (typeof window === 'undefined') return SAMPLE_AD_TAGS.VMAP_STANDARD;
  return (
    process.env.NEXT_PUBLIC_GOOGLE_VIDEO_AD_TAG ||
    SAMPLE_AD_TAGS.VMAP_STANDARD
  );
}
