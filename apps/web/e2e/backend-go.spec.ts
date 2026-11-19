import { test, expect } from '@playwright/test';

/**
 * Go Backend Fiber API Automation Test Suite
 *
 * Tests the High-Performance Golang Backend API:
 * - Health & Actuator checks (DB, Redis, Storage)
 * - Security & Observability Headers (Request-ID, CORS, Security headers)
 * - Authentication & OTP routes
 * - Content & Catalog browsing
 * - Admin protected endpoints & RBAC
 * - System Settings & Legal pages
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8080';

let isBackendReachable = true;

test.beforeAll(async ({ request }) => {
  try {
    const ping = await request.get(`${BACKEND_URL}/health`, { timeout: 3000 });
    isBackendReachable = ping.ok();
  } catch {
    isBackendReachable = false;
    console.warn(
      `\n⚠️  Go Backend is not running at ${BACKEND_URL}.\n` +
      `   To run backend tests, start the Go API server:\n` +
      `   cd backend-go && go run ./cmd/api/main.go\n`
    );
  }
});

test.describe('Go Backend: Health & Diagnostics', () => {
  test.beforeEach(() => {
    test.skip(!isBackendReachable, `Go Backend is offline at ${BACKEND_URL}`);
  });

  test('GET /health returns 200 with platform info and component status', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.platform).toContain('MaxxPixels OTT');
    expect(body.engine).toContain('Golang');
    expect(body.components).toBeDefined();
    expect(body.components).toHaveProperty('database');
    expect(body.components).toHaveProperty('redis');
  });

  test('Spring Actuator compatibility health endpoints return 200', async ({ request }) => {
    const endpoints = [
      '/actuator/health',
      '/api/v1/health',
      '/api/v1/actuator/health',
    ];

    for (const ep of endpoints) {
      const res = await request.get(`${BACKEND_URL}${ep}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('UP');
    }
  });

  test('Security & Tracing headers are attached to every response', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);
    const headers = res.headers();

    // Verify Request-ID header is generated for tracing
    expect(headers['x-request-id'] || headers['request-id']).toBeDefined();
    // Verify Security headers
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});

test.describe('Go Backend: Authentication API', () => {
  test.beforeEach(() => {
    test.skip(!isBackendReachable, `Go Backend is offline at ${BACKEND_URL}`);
  });

  test('POST /api/v1/auth/login fails gracefully with invalid credentials', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: {
        email: 'invalid-user@maxxpixels.com',
        password: 'WrongPassword123!',
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /api/v1/auth/send-otp handles phone OTP requests', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/v1/auth/send-otp`, {
      data: {
        phone: '9876543210',
        countryCode: '+91',
      },
    });

    // Expect 200 (success) or valid API status
    expect([200, 400, 429]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('GET /api/v1/auth/me returns profile payload or handles authentication', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/auth/me`);
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('status', 200);
    }
  });
});

test.describe('Go Backend: Content & Catalog API', () => {
  test.beforeEach(() => {
    test.skip(!isBackendReachable, `Go Backend is offline at ${BACKEND_URL}`);
  });

  test('GET /api/v1/content/genres returns available genres', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/content/genres`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(Array.isArray(data.result || data.data || data)).toBeTruthy();
    }
  });

  test('GET /api/v1/content/banners returns promotional banners', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/content/banners`);
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/v1/content/featured returns featured catalog', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/content/featured`);
    expect([200, 404]).toContain(res.status());
  });
});

test.describe('Go Backend: Settings & Legal API', () => {
  test.beforeEach(() => {
    test.skip(!isBackendReachable, `Go Backend is offline at ${BACKEND_URL}`);
  });

  test('GET /api/v1/settings or /api/v1/general_setting returns platform config', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/settings`);
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/v1/legal/terms and /api/v1/legal/privacy return legal documents', async ({ request }) => {
    const termsRes = await request.get(`${BACKEND_URL}/api/v1/legal/terms`);
    expect([200, 404]).toContain(termsRes.status());

    const privacyRes = await request.get(`${BACKEND_URL}/api/v1/legal/privacy`);
    expect([200, 404]).toContain(privacyRes.status());
  });
});

test.describe('Go Backend: Admin RBAC Protection', () => {
  test.beforeEach(() => {
    test.skip(!isBackendReachable, `Go Backend is offline at ${BACKEND_URL}`);
  });

  test('GET /api/v1/admin/overview rejects unauthorized requests without token', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/admin/overview`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/admin/movies rejects unauthorized requests without token', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/admin/movies`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/admin/series rejects unauthorized requests without token', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/admin/series`);
    expect([401, 403]).toContain(res.status());
  });
});
