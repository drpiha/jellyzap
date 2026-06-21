import { test, expect } from '@playwright/test';

test('game page has full SEO meta and structured data', async ({ page }) => {
  await page.goto('/en/g/snake/');

  await expect(page).toHaveTitle(/Snake/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('h1')).toBeVisible();

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocks.map((b) => JSON.parse(b)['@type']);
  expect(types).toContain('VideoGame');
  expect(types).toContain('BreadcrumbList');
  expect(types).toContain('FAQPage');
  expect(types).toContain('HowTo');
});
