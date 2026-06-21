import { test, expect } from '@playwright/test';

test('robots.txt allows AI crawlers and links the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  expect(body).toContain('Sitemap:');
  expect(body).toContain('GPTBot');
});

test('sitemap, llms.txt and manifest are served', async ({ request }) => {
  const sitemap = await request.get('/sitemap-index.xml');
  expect(sitemap.ok()).toBeTruthy();

  const llms = await request.get('/llms.txt');
  expect(llms.ok()).toBeTruthy();
  expect(await llms.text()).toContain('# Jellyzap');

  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.name).toContain('Jellyzap');
  expect(Array.isArray(json.icons)).toBe(true);
});
