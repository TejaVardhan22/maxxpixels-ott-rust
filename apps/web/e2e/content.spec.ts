import { test, expect } from '@playwright/test';

test.describe('Content pages', () => {
  test('related content page reads videoType and typeId from query params', async ({ page }) => {
    await page.goto('/related/1?videoType=1&typeId=1');
    await expect(page.getByText(/related content/i)).toBeVisible();
  });

  test('related content page falls back gracefully without query params', async ({ page }) => {
    await page.goto('/related/1');
    await expect(page.getByText(/related content/i)).toBeVisible();
  });

  test('avatar selection page loads', async ({ page }) => {
    await page.goto('/avatar');
    await expect(page.getByText(/choose avatar/i)).toBeVisible();
  });

  test('myspace page loads', async ({ page }) => {
    await page.goto('/myspace');
    await expect(page).toHaveURL('/myspace');
  });

  test('downloads page loads', async ({ page }) => {
    await page.goto('/downloads');
    await expect(page).toHaveURL('/downloads');
  });

  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL('/notifications');
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
  });
});

test.describe('Payment pages', () => {
  test('subscription page loads', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page).toHaveURL('/subscription');
  });

  test('payment success page loads', async ({ page }) => {
    await page.goto('/paymentsuccess');
    await expect(page).toHaveURL('/paymentsuccess');
  });

  test('payment cancel page loads', async ({ page }) => {
    await page.goto('/paymentcancel');
    await expect(page).toHaveURL('/paymentcancel');
  });
});
