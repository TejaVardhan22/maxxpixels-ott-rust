import { test, expect } from '@playwright/test';

/**
 * Optional integration smoke against the Spring Boot API (same routes as @ott/shared catalogApi).
 *
 * Requires a running backend and matching token:
 *   set API_BACKEND_URL=http://127.0.0.1:8080/api/v1
 *   set API_TOKEN=<same as Spring Boot application.properties API_TOKEN>
 *
 * On Windows PowerShell:
 *   $env:API_BACKEND_URL="http://127.0.0.1:8080/api/v1"; $env:API_TOKEN="your-token"; npx playwright test e2e/api-backend.spec.ts
 *
 * Skips when env vars are unset (default local Next-only runs).
 */
test.describe('Spring Boot API (optional)', () => {
  test('POST /api/general_setting returns 200 with valid Api-Token', async ({ request }) => {
    const base = process.env.API_BACKEND_URL?.replace(/\/$/, '');
    const token = process.env.API_TOKEN;
    test.skip(!base || !token, 'Set API_BACKEND_URL and API_TOKEN to run API smoke tests.');

    const response = await request.post(`${base}/api/general_setting`, {
      data: {},
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': token!,
      },
    });

    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status', 200);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('result');
  });
});
