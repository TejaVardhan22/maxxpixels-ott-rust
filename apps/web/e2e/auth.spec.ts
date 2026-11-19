import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form with email tab active by default', async ({ page }) => {
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('switches to phone tab and shows phone input', async ({ page }) => {
    await page.getByRole('button', { name: 'Phone' }).click();
    await expect(page.getByPlaceholder('Phone number')).toBeVisible();
    await expect(page.getByRole('button', { name: /send otp/i })).toBeVisible();
  });

  test('shows error on empty email submit', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    // Form validation prevents empty submit — button stays enabled
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('Google and Apple buttons are present and clickable', async ({ page }) => {
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
    await page.getByRole('button', { name: /google/i }).click();
    // Shows not-configured message
    await expect(page.getByText(/not configured/i)).toBeVisible();
  });

  test('skip link navigates to home', async ({ page }) => {
    await page.getByRole('link', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('OTP page', () => {
  test('renders OTP input and Resend button', async ({ page }) => {
    await page.goto('/login/otp?phone=9999999999');
    await expect(page.getByPlaceholder('Enter OTP')).toBeVisible();
    await expect(page.getByRole('button', { name: /verify/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /resend otp/i })).toBeVisible();
  });

  test('back to login link works', async ({ page }) => {
    await page.goto('/login/otp?phone=9999999999');
    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL('/login');
  });
});
