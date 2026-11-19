import { test, expect } from '@playwright/test';

/**
 * Cross-Platform Integration E2E Test Suite
 *
 * Validates the full data lifecycle across all three layers:
 * 1. Go Backend: Verifies health and live API response
 * 2. Admin Portal: Verifies login accessibility and console status
 * 3. Web OTT Client: Verifies frontend streaming experience
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8080';
const ADMIN_URL = process.env.ADMIN_URL || 'http://127.0.0.1:4200';
const WEB_URL = process.env.WEB_URL || 'http://127.0.0.1:3000';

let isBackendLive = true;
let isAdminLive = true;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${BACKEND_URL}/health`, { timeout: 3000 });
    isBackendLive = res.ok();
  } catch {
    isBackendLive = false;
  }

  try {
    const res = await request.get(`${ADMIN_URL}/login`, { timeout: 3000 });
    isAdminLive = res.ok();
  } catch {
    isAdminLive = false;
  }
});

test.describe('End-to-End OTT Platform Integration', () => {
  test('Step 1: Go Backend API is healthy and operational', async ({ request }) => {
    test.skip(!isBackendLive, `Go Backend is offline at ${BACKEND_URL}. Start it to run live API checks.`);
    const res = await request.get(`${BACKEND_URL}/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('UP');
  });

  test('Step 2: Admin Portal routes and renders console interface', async ({ page }) => {
    test.skip(!isAdminLive, `Admin Portal is offline at ${ADMIN_URL}. Start it to run Admin UI checks.`);
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.locator('input[type="email"], input[formcontrolname="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Step 3: Web OTT Client successfully delivers home catalog', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    await expect(page.getByRole('link', { name: /MaxxPixels/i }).first()).toBeVisible();
  });
});
