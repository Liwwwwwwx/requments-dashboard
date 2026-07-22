"use strict";
const crypto = require("crypto");
const { query } = require("../postgres");

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

/**
 * 登录限流中间件。
 * 同一 identifier（用户名或 IP）在 15 分钟内连续失败 5 次后，
 * 后续登录尝试将被拒绝 15 分钟。
 *
 * 用法：router.post("/auth/login", rateLimiter(), handler)
 */
function rateLimiter() {
  return async function (req, res, next) {
    const username = String(req.body?.username || "").trim();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const identifier = username || ip;

    // 统计最近窗口内的失败次数
    const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const attempts = await query(
      `SELECT COUNT(*)::int AS count
       FROM login_attempts
       WHERE identifier = $1 AND attempted_at >= $2 AND success = false`,
      [identifier, cutoff]
    );

    if (attempts.rows[0].count >= MAX_FAILURES) {
      return res.status(429).json({
        ok: false,
        code: "LOGIN_RATE_LIMITED",
        message: `连续登录失败次数过多，请 ${WINDOW_MINUTES} 分钟后再试。`
      });
    }

    // 挂载标识符到 request，供路由记录登录结果
    req._loginIdentifier = identifier;
    next();
  };
}

/**
 * 记录一次登录尝试。
 * 在登录路由处理完成后调用。
 */
async function recordLoginAttempt(identifier, success) {
  const id = `LA-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await query(
    `INSERT INTO login_attempts (id, identifier, attempted_at, success)
     VALUES ($1, $2, now(), $3)`,
    [id, identifier, success]
  );
}

module.exports = { rateLimiter, recordLoginAttempt };
