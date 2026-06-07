import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock heavy dependencies before importing security.ts
vi.mock('../server/db.ts', () => ({
  AuditLog: { insert: vi.fn() },
  Sessions: {
    create: vi.fn(),
    getByRefreshToken: vi.fn(),
    revoke: vi.fn(),
  },
  Users: {
    getById: vi.fn(),
  },
}));

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      incr: vi.fn(),
      pexpire: vi.fn(),
    })),
  };
});

describe('rateLimit (in-memory fallback)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', async () => {
    const { rateLimit } = await import('../server/security.ts');
    const limit = 3;
    const middleware = rateLimit('test-allow', limit, 60_000);

    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    for (let i = 0; i < limit; i++) {
      const req = { ip: '1.2.3.4' } as any;
      middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(limit);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks the (limit+1)th request with 429', async () => {
    const { rateLimit } = await import('../server/security.ts');
    const limit = 3;
    const middleware = rateLimit('test-block', limit, 60_000);

    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    // exhaust limit
    for (let i = 0; i < limit; i++) {
      middleware({ ip: '10.0.0.1' } as any, res, next);
    }
    // one more — should be blocked
    middleware({ ip: '10.0.0.1' } as any, res, next);

    expect(next).toHaveBeenCalledTimes(limit);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();

    const { rateLimit } = await import('../server/security.ts');
    const limit = 2;
    const windowMs = 5_000;
    const middleware = rateLimit('test-reset', limit, windowMs);

    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const req = { ip: '192.168.1.1' } as any;

    // exhaust limit
    for (let i = 0; i < limit; i++) {
      middleware(req, res, next);
    }
    // blocked
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(limit);
    expect(res.status).toHaveBeenCalledWith(429);

    // advance past the window
    vi.advanceTimersByTime(windowMs + 1);

    // should be allowed again
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(limit + 1);
  });
});
