import { test, expect } from '@playwright/test';

test('locales set html lang and reciprocal hreflang alternates', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const alts = page.locator('link[rel="alternate"][hreflang]');
  expect(await alts.count()).toBeGreaterThanOrEqual(4); // en, tr, de, x-default

  await page.goto('/tr/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');

  await page.goto('/de/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('language switcher links to the same page in another locale', async ({ page }) => {
  await page.goto('/en/games');
  const trLink = page.locator('.lang a[hreflang="tr"]');
  await expect(trLink).toHaveAttribute('href', /\/tr\/games\/?$/);
});
