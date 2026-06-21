import { test, expect } from '@playwright/test';

// Discovers every game from the catalog and verifies each one boots cleanly with
// a fixed seed (deterministic), mounts its canvas, and throws no uncaught errors.
test('every game in the catalog boots and mounts a canvas', async ({ page }) => {
  await page.goto('/en/games/');
  const hrefs: string[] = await page
    .locator('a[href*="/g/"]')
    .evaluateAll((els) =>
      Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || ''))).filter(
        Boolean,
      ),
    );
  expect(hrefs.length).toBeGreaterThan(0);

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));

  for (const href of hrefs) {
    await page.goto(`${href}?seed=42`);
    await expect(page.locator('h1')).toBeVisible();
    await page.click('[data-jz-play]');
    await expect(page.locator('[data-jz-mount] canvas')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(
      () => (window as unknown as { __jzHost?: unknown }).__jzHost !== undefined,
      undefined,
      { timeout: 15000 },
    );
  }

  expect(errors, errors.join('\n')).toEqual([]);
});
