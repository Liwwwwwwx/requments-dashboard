"use strict";

/**
 * 简单内存限流中间件（按 userId）。
 *
 * 适用于单进程部署。生产用 pm2 cluster / 多机时需要换成 Redis 之类；
 * 目前的需求是一个用户短时间内不要狂点「发送」。
 *
 * 默认：每用户每分钟 30 次 chat 请求（不区分项目）。
 */

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;

function createRateLimiter({ limit = DEFAULT_LIMIT, windowMs = WINDOW_MS } = {}) {
  const hits = new Map(); // userId -> [timestamp, ...]

  function purge(userId, now) {
    const list = hits.get(userId);
    if (!list) return;
    while (list.length > 0 && now - list[0] >= windowMs) {
      list.shift();
    }
    if (list.length === 0) {
      hits.delete(userId);
    }
  }

  function middleware(req, res, next) {
    const userId = req.user?.id || "anonymous";
    const now = Date.now();
    purge(userId, now);
    const list = hits.get(userId) || [];
    if (list.length >= limit) {
      const retryAfterSec = Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        ok: false,
        code: "AI_RATE_LIMITED",
        error: `请求过于频繁，每 ${retryAfterSec} 秒最多 ${limit} 次`,
        limit,
        windowMs
      });
      return;
    }
    list.push(now);
    hits.set(userId, list);
    next();
  }

  middleware.reset = () => hits.clear();
  return middleware;
}

module.exports = { createRateLimiter };