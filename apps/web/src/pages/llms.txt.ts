import type { APIRoute } from 'astro';
import { getPlayableGames, L } from '../lib/games';

// GEO: a machine-readable summary for AI/LLM crawlers (https://llmstxt.org).
export const GET: APIRoute = async ({ site }) => {
  const games = await getPlayableGames();
  const base = (site ?? new URL('https://jellyzap.com')).href.replace(/\/$/, '');
  const lines = [
    '# Jellyzap',
    '',
    '> Jellyzap is a free online games portal for kids, teens and families. Every game runs instantly in the browser with no download. Available in English (/en/), Turkish (/tr/) and German (/de/).',
    '',
    '## Games',
    ...games.map((g) => `- [${L(g.data.title, 'en')}](${base}/en/g/${g.data.slug}): ${L(g.data.tagline, 'en')}`),
    '',
    '## Key pages',
    `- [All games](${base}/en/games)`,
    `- [About](${base}/en/about)`,
    `- [Privacy Policy](${base}/en/privacy)`,
    '',
    '## Notes',
    '- All games are free to play and ad-supported.',
    '- Content is family-friendly; ads to younger audiences are non-personalized.',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
