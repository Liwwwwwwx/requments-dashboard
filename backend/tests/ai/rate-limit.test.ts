import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from '@/ai/rate-limit';

function makeReqRes(userId: string) {
  const req: any = { user: { id: userId } };
  const res: any = {
    statusCode: 200,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
  return { req, res };
}

describe('ai/rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));
  });

  it('limit 内允许', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i += 1) {
      const { req, res } = makeReqRes('u1');
      let nextCalled = false;
      limiter(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    }
  });

  it('超过 limit 拒绝并设 Retry-After', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter(makeReqRes('u1').req, makeReqRes('u1').res, () => {});
    limiter(makeReqRes('u1').req, makeReqRes('u1').res, () => {});

    const { req, res } = makeReqRes('u1');
    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('AI_RATE_LIMITED');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('不同 user 互不干扰', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    let n1 = false;
    let n2 = false;
    limiter(makeReqRes('u1').req, makeReqRes('u1').res, () => (n1 = true));
    limiter(makeReqRes('u2').req, makeReqRes('u2').res, () => (n2 = true));
    expect(n1).toBe(true);
    expect(n2).toBe(true);
  });

  it('窗口过期后重新计数', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter(makeReqRes('u1').req, makeReqRes('u1').res, () => {});
    vi.advanceTimersByTime(1500);
    let nextCalled = false;
    limiter(makeReqRes('u1').req, makeReqRes('u1').res, () => (nextCalled = true));
    expect(nextCalled).toBe(true);
  });
});