/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ADS_ENABLED?: string;
  readonly PUBLIC_AD_PUBLISHER_ID?: string;
  readonly PUBLIC_AD_SLOT_BANNER?: string;
  readonly PUBLIC_AD_SLOT_INCONTENT?: string;
  readonly PUBLIC_AD_SLOT_SIDEBAR?: string;
  readonly PUBLIC_AD_SLOT_INTERSTITIAL?: string;
  readonly PUBLIC_AD_SLOT_REWARDED?: string;
  readonly PUBLIC_GA4_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
