import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock db dependency used inside google-services
vi.mock('../../server/db', () => ({
  AuditLog: { insert: vi.fn() },
  OAuthAccounts: { get: vi.fn(), update: vi.fn() },
}));

import { refreshGoogleToken } from '../../server/google-services';

describe('refreshGoogleToken', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = originalEnv.GOOGLE_OAUTH_CLIENT_ID;
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = originalEnv.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it('throws when GOOGLE_OAUTH_CLIENT_ID is missing', async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await expect(refreshGoogleToken('some-refresh-token'))
      .rejects.toThrow('Google OAuth no configurado');
  });

  it('throws when GOOGLE_OAUTH_CLIENT_SECRET is missing', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await expect(refreshGoogleToken('some-refresh-token'))
      .rejects.toThrow('Google OAuth no configurado');
  });

  it('throws when both env vars are missing', async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await expect(refreshGoogleToken('any-token'))
      .rejects.toThrow('Google OAuth no configurado');
  });

  it('calls fetch when env vars are present (mock fetch)', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-access-token' }),
    });
    global.fetch = mockFetch as any;

    const token = await refreshGoogleToken('valid-refresh-token');
    expect(token).toBe('new-access-token');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Restore fetch
    global.fetch = originalFetch;
  });

  it('throws when Google returns error response', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired' }),
    }) as any;

    await expect(refreshGoogleToken('expired-token'))
      .rejects.toThrow('Token has been expired');

    global.fetch = originalFetch;
  });
});

const originalFetch = global.fetch;
