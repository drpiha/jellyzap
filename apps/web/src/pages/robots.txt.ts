import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site ?? 'https://jellyzap.com').href;
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Generative / AI engines are welcome (GEO)',
    'User-agent: GPTBot',
    'Allow: /',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    'User-agent: ChatGPT-User',
    'Allow: /',
    'User-agent: ClaudeBot',
    'Allow: /',
    'User-agent: anthropic-ai',
    'Allow: /',
    'User-agent: Google-Extended',
    'Allow: /',
    'User-agent: PerplexityBot',
    'Allow: /',
    'User-agent: CCBot',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
