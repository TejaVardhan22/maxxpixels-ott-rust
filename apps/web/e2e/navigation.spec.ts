import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('navbar is present on home page', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByRole('link', { name: 'MaxxPixels' })).toBeVisible();
  });

  test('can navigate to search page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /search/i }).first().click();
    await expect(page).toHaveURL('/search');
  });

  test('can navigate to subscription page', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page).toHaveURL('/subscription');
  });

  test('can navigate to shorts page', async ({ page }) => {
    await page.goto('/shorts');
    await expect(page).toHaveURL('/shorts');
  });

  test('store page loads', async ({ page }) => {
    await page.goto('/store');
    await expect(page).toHaveURL('/store');
  });

  test('wallet history page loads (guest sees empty state)', async ({ page }) => {
    await page.goto('/wallethistory');
    await expect(page).toHaveURL('/wallethistory');
    // Guest user — no transactions shown
    await expect(page.getByText(/no transactions/i)).toBeVisible();
  });

  test('continue watching page loads', async ({ page }) => {
    await page.goto('/continuewatching');
    await expect(page).toHaveURL('/continuewatching');
    await expect(page.getByText(/continue watching/i)).toBeVisible();
  });
});
