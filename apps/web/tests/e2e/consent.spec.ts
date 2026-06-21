import { test, expect } from '@playwright/test';

const TRACKERS = /googletagmanager|google-analytics|adsbygoogle|pagead2|doubleclick/;

test('no analytics/ad scripts load before consent', async ({ page }) => {
  const tracker: string[] = [];
  page.on('request', (r) => {
    if (TRACKERS.test(r.url())) tracker.push(r.url());
  });
  await page.goto('/en/');
  await expect(page.locator('#jz-consent')).toBeVisible();
  expect(tracker).toEqual([]);
});

test('accepting consent hides the banner and stores the choice', async ({ page }) => {
  await page.goto('/en/');
  await page.click('[data-jz-accept]');
  await expect(page.locator('#jz-consent')).toBeHidden();
  const stored = await page.evaluate(() => localStorage.getItem('jz:consent:v1'));
  expect(stored).toContain('analytics');
});
