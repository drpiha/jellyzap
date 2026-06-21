import { test, expect } from '@playwright/test';

test('home page loads with hero and game cards', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('h1')).toBeVisible();
  const cards = page.locator('a[href*="/g/"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
});

test('header navigation reaches the all-games page', async ({ page }) => {
  await page.goto('/en/');
  await page.locator('header a[href="/en/games"]').first().click();
  await expect(page).toHaveURL(/\/en\/games/);
  await expect(page.locator('h1')).toBeVisible();
});
