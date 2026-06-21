import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const manifest = {
    name: 'Jellyzap — Free Online Games',
    short_name: 'Jellyzap',
    description: 'Free online games for everyone. Play instantly, no download.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#16092e',
    theme_color: '#16092e',
    lang: 'en',
    dir: 'ltr',
    categories: ['games', 'entertainment', 'kids'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
