"use strict";
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { initUsers } = require("./users");
const {
  signAccess,
  signRefresh,
  verifyRefresh,
  saveRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  findRefreshToken,
  isFamilyCompromised
} = require("./tokens");
const { authMiddleware } = require("./middleware");
const { rateLimiter, recordLoginAttempt } = require("./rate-limiter");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function clearCookieOptions() {
  return { httpOnly: true, secure: COOKIE_OPTIONS.secure, sameSite: "lax", path: "/" };
}

function formatUser(user) {
  return { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
}

/**
 * 签发 access + refresh token 对并持久化 refresh token。
 * @param {object} user
 * @param {object} res - express response (for cookie)
 * @param {string} [existingFamily] - 轮换时传入旧的 family，登录时传 undefined 生成新 family
 */
async function issueTokenPair(user, res, existingFamily) {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  const decoded = verifyRefresh(refreshToken);
  const family = existingFamily || `rf-${user.id}-${crypto.randomUUID()}`;
  await saveRefreshToken(user.id, decoded.jti, family);
  res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);
  return { accessToken, refreshToken };
}

function createAuthRoutes(rootDir) {
  const users = initUsers();
  const requireAuth = authMiddleware(users);
  const router = express.Router();

  // -- 注册 --

  router.post("/auth/register", express.json(), async (req, res) => {
    if (process.env.ALLOW_REGISTRATION !== "true") {
      return res.status(403).json({ ok: false, code: "REGISTRATION_DISABLED", message: "注册功能未开放。" });
    }
    const { username, password, displayName } = req.body || {};
    const normalizedUsername = String(username || "").trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(normalizedUsername)) {
      return res.status(400).json({ ok: false, code: "INVALID_USERNAME", message: "用户名需为 3–32 位字母、数字或 ._-。" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ ok: false, code: "WEAK_PASSWORD", message: "密码至少需要 8 位。" });
    }
    if (await users.findByUsername(normalizedUsername)) {
      return res.status(409).json({ ok: false, code: "USERNAME_TAKEN", message: "该用户名已被注册。" });
    }
    const user = await users.create({ username: normalizedUsername, password, displayName });
    const { accessToken } = await issueTokenPair(user, res);
    return res.status(201).json({
      ok: true,
      user: formatUser(user),
      accessToken
    });
  });

  // -- 登录（含限流） --

  router.post("/auth/login", rateLimiter(), express.json(), async (req, res) => {
    const { username, password } = req.body || {};
    const identifier = req._loginIdentifier || String(username || "").trim();

    if (!username || !password) {
      await recordLoginAttempt(identifier, false);
      return res.status(400).json({ ok: false, code: "MISSING_CREDENTIALS", message: "请提供用户名和密码。" });
    }

    const user = await users.findByUsername(username);
    if (!user || !users.verifyPassword(user, password)) {
      await recordLoginAttempt(identifier, false);
      return res.status(401).json({ ok: false, code: "INVALID_CREDENTIALS", message: "用户名或密码错误。" });
    }

    await recordLoginAttempt(identifier, true);
    const { accessToken } = await issueTokenPair(user, res);
    return res.json({
      ok: true,
      user: formatUser(user),
      accessToken
    });
  });

  // -- 刷新 Token（轮换机制） --

  router.post("/auth/refresh", express.json(), async (req, res) => {
    const token = req.cookies && req.cookies.refresh_token;
    if (!token) {
      return res.status(401).json({ ok: false, code: "NO_REFRESH_TOKEN", message: "未提供刷新令牌。" });
    }

    let decoded;
    try {
      decoded = verifyRefresh(token);
    } catch (_err) {
      return res.status(401).json({ ok: false, code: "INVALID_REFRESH_TOKEN", message: "刷新令牌无效或已过期。" });
    }

    // 检查 token 在 DB 中的状态
    const stored = await findRefreshToken(decoded.jti);
    if (!stored) {
      // token 不在数据库中（可能已被撤销或从未签发）
      return res.status(401).json({ ok: false, code: "REFRESH_TOKEN_NOT_FOUND", message: "刷新令牌不存在。" });
    }

    if (stored.revoked) {
      // token 已被撤销 — 这意味着有人在用已轮换掉的旧 token，是重放攻击的迹象
      await revokeTokenFamily(stored.family);
      return res.status(401).json({ ok: false, code: "REFRESH_TOKEN_REVOKED", message: "刷新令牌已被撤销，请重新登录。" });
    }

    // 检查是否过期
    if (new Date(stored.expires_at) < new Date()) {
      await revokeRefreshToken(decoded.jti);
      return res.status(401).json({ ok: false, code: "REFRESH_TOKEN_EXPIRED", message: "刷新令牌已过期，请重新登录。" });
    }

    // 检查 family 是否已被泄露（有更新的 token 已签发但仍有人使用旧 token）
    const compromised = await isFamilyCompromised(stored.family, decoded.jti);
    if (compromised) {
      await revokeTokenFamily(stored.family);
      return res.status(401).json({ ok: false, code: "TOKEN_FAMILY_COMPROMISED", message: "令牌已被其他设备使用，请重新登录。" });
    }

    // 查找用户
    const user = await users.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ ok: false, code: "USER_NOT_FOUND", message: "用户不存在。" });
    }

    // 撤销旧 token，签发新 token pair（同 family）
    await revokeRefreshToken(decoded.jti);
    const { accessToken } = await issueTokenPair(user, res, stored.family);

    return res.json({
      ok: true,
      accessToken,
      user: formatUser(user)
    });
  });

  // -- 登出 --

  router.post("/auth/logout", async (req, res) => {
    const token = req.cookies && req.cookies.refresh_token;
    if (token) {
      try {
        const decoded = verifyRefresh(token);
        await revokeRefreshToken(decoded.jti);
      } catch (_err) {
        // token 已过期或无效，忽略 — 目标就是让它失效
      }
    }
    res.clearCookie("refresh_token", clearCookieOptions());
    return res.json({ ok: true });
  });

  // -- 当前用户 --

  router.get("/auth/me", requireAuth, (req, res) => {
    return res.json({ ok: true, user: req.user });
  });

  // -- 404 兜底 --

  router.use("/auth", (_req, res) => {
    return res.status(404).json({ ok: false, code: "AUTH_ROUTE_NOT_FOUND", message: "认证接口不存在。" });
  });

  return router;
}

module.exports = { createAuthRoutes };
