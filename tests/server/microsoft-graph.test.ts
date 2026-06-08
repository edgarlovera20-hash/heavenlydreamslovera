import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db dependency
vi.mock('../../server/db', () => ({
  AuditLog: { insert: vi.fn() },
}));

import { sendTeamsWebhookMessage } from '../../server/microsoft-graph';

describe('sendTeamsWebhookMessage validation', () => {
  it('throws when webhookUrl is empty', async () => {
    await expect(sendTeamsWebhookMessage('', { title: 'Test', text: 'Hello' }))
      .rejects.toThrow('URL de webhook de Teams no configurada');
  });

  it('throws when URL is not https', async () => {
    await expect(
      sendTeamsWebhookMessage('http://webhook.office.com/test', { title: 'T', text: 'B' })
    ).rejects.toThrow('HTTPS');
  });

  it('throws when URL is not a valid URL', async () => {
    await expect(
      sendTeamsWebhookMessage('not-a-url', { title: 'T', text: 'B' })
    ).rejects.toThrow();
  });

  it('throws for non-office hostname (e.g. attacker.com)', async () => {
    await expect(
      sendTeamsWebhookMessage('https://attacker.com/webhook', { title: 'T', text: 'B' })
    ).rejects.toThrow('URL de webhook no reconocida');
  });

  it('throws for https but wrong domain (not office.com or azure.com)', async () => {
    await expect(
      sendTeamsWebhookMessage('https://evil.webhook.example.com/hook', { title: 'T', text: 'B' })
    ).rejects.toThrow();
  });

  it('accepts a valid webhook.office.com URL (attempts fetch, may fail on network)', async () => {
    // We do NOT actually call out — mock global fetch to avoid network
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
    await expect(
      sendTeamsWebhookMessage('https://myorg.webhook.office.com/webhookb2/test', {
        title: 'Hello',
        text: 'World',
      })
    ).resolves.toBe(true);
    global.fetch = originalFetch;
  });

  it('accepts a valid logic.azure.com URL', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
    await expect(
      sendTeamsWebhookMessage('https://prod-12.logic.azure.com:443/workflows/test', {
        title: 'Title',
        text: 'Body',
      })
    ).resolves.toBe(true);
    global.fetch = originalFetch;
  });
});
