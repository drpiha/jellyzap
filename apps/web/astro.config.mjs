// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE = process.env.PUBLIC_SITE_URL || 'https://jellyzap.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', tr: 'tr', de: 'de' },
      },
      // only localized pages belong in the sitemap (drops the root redirect)
      filter: (page) => /\/(en|tr|de)(\/|$)/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: { inlineStylesheets: 'auto' },
});
