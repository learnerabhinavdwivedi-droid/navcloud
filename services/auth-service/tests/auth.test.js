import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { createAuthApp } = await import('../dist/index.js');

function buildEnv(overrides = {}) {
  return {
    PORT: '4000',
    APP_BASE_URL: 'http://localhost:4000',
    CLIENT_REDIRECT_URL: 'http://localhost:5173',
    JWT_ACCESS_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    JWT_REFRESH_SECRET: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    JWT_ISSUER: 'navcloud-auth',
    JWT_AUDIENCE: 'navcloud',
    ACCESS_TOKEN_TTL_SECONDS: 2,
    REFRESH_TOKEN_TTL_SECONDS: 30,
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/auth/google/callback',
    GOOGLE_ADMIN_EMAILS: 'admin@navcloud.io',
    GOOGLE_INSTRUCTOR_EMAILS: 'instructor@navcloud.io',
    DELIVERY_BASE_URL: 'https://files.navcloud.example/content',
    DELIVERY_SIGNING_SECRET: 'cccccccccccccccccccccccccccccccc',
    DELIVERY_URL_TTL_SECONDS: 120,
    ...overrides
  };
}

async function call(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

test('oauth login + rbac + refresh + logout + expiry', async () => {
  const baseTime = new Date('2026-01-01T00:00:00.000Z');
  let offsetMs = 0;
  let seq = 1;

  const app = createAuthApp(buildEnv(), {
    now: () => new Date(baseTime.getTime() + offsetMs),
    randomId: () => `id-${seq++}`,
    google: {
      getAuthorizationUrl: (state) => `https://accounts.google.com/mock?state=${state}`,
      exchangeCodeForProfile: async (code) => {
        if (code === 'admin-code') return { email: 'admin@navcloud.io', name: 'Admin User' };
        if (code === 'student-code') return { email: 'student@navcloud.io', name: 'Student User' };
        throw new Error('invalid_code');
      }
    }
  });

  const server = app.listen(0);
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const start = await call(baseUrl, '/auth/google/start');
    assert.equal(start.status, 200);
    assert.equal(start.body.scope, 'openid email');

    const callback = await call(baseUrl, `/auth/google/callback?code=admin-code&state=${start.body.state}`);
    assert.equal(callback.status, 200);
    assert.equal(callback.body.user.role, 'Admin');

    const adminArea = await call(baseUrl, '/rbac/admin', {
      headers: { Authorization: `Bearer ${callback.body.accessToken}` }
    });
    assert.equal(adminArea.status, 200);

    const refresh = await call(baseUrl, '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: callback.body.refreshToken })
    });
    assert.equal(refresh.status, 200);

    const reused = await call(baseUrl, '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: callback.body.refreshToken })
    });
    assert.equal(reused.status, 401);

    const logout = await call(baseUrl, '/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh.body.refreshToken })
    });
    assert.equal(logout.status, 200);

    const afterLogout = await call(baseUrl, '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh.body.refreshToken })
    });
    assert.equal(afterLogout.status, 401);

    await new Promise((resolve) => setTimeout(resolve, 2200));
    const expired = await call(baseUrl, '/auth/me', {
      headers: { Authorization: `Bearer ${refresh.body.accessToken}` }
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.body.error, 'token_expired');

    const s2 = await call(baseUrl, '/auth/google/start');
    const student = await call(baseUrl, `/auth/google/callback?code=student-code&state=${s2.body.state}`);
    assert.equal(student.status, 200);
    assert.equal(student.body.user.role, 'Student');

    const denied = await call(baseUrl, '/rbac/admin', {
      headers: { Authorization: `Bearer ${student.body.accessToken}` }
    });
    assert.equal(denied.status, 403);

    const s3 = await call(baseUrl, '/auth/google/start');
    offsetMs = 11 * 60 * 1000;
    const expiredState = await call(baseUrl, `/auth/google/callback?code=student-code&state=${s3.body.state}`);
    assert.equal(expiredState.status, 400);
    assert.equal(expiredState.body.error, 'expired_state');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
