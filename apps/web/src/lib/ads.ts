/**
 * Ad configuration — a single source of truth with PLACEHOLDER ids that the
 * owner fills in later via env vars (see .env.example). Until `enabled` is true
 * with a real publisher id, ad slots render reserved-size placeholders and no ad
 * network script is loaded. Ads never load before cookie consent.
 */
export const AD_CONFIG = {
  enabled: (import.meta.env.PUBLIC_ADS_ENABLED ?? 'false') === 'true',
  publisherId: import.meta.env.PUBLIC_AD_PUBLISHER_ID ?? 'ca-pub-XXXXXXXXXXXXXXXX',
  slots: {
    banner: import.meta.env.PUBLIC_AD_SLOT_BANNER ?? '',
    inContent: import.meta.env.PUBLIC_AD_SLOT_INCONTENT ?? '',
    sidebar: import.meta.env.PUBLIC_AD_SLOT_SIDEBAR ?? '',
    interstitial: import.meta.env.PUBLIC_AD_SLOT_INTERSTITIAL ?? '',
    rewarded: import.meta.env.PUBLIC_AD_SLOT_REWARDED ?? '',
  },
  /** minimum seconds between interstitials */
  frequencyCapSeconds: 60,
  /** COPPA: our audience includes children → request non-personalized ads */
  childDirected: true,
} as const;

export type AdPlacement = 'banner' | 'inContent' | 'sidebar';

/** Reserved dimensions per placement so ad slots never cause layout shift (CLS). */
export const AD_SIZES: Record<AdPlacement, { w: number; h: number }> = {
  banner: { w: 970, h: 90 },
  inContent: { w: 728, h: 90 },
  sidebar: { w: 300, h: 250 },
};
