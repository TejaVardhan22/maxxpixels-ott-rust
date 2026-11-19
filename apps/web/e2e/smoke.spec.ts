import { test, expect } from '@playwright/test';

test('home loads and MaxxPixels brand is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'MaxxPixels' }).first()).toBeVisible();
});
