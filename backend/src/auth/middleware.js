"use strict";
const { verifyAccess } = require("./tokens");

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function matchesApiToken(token) {
  const apiToken = process.env.REQUIREMENTS_API_TOKEN;
  return Boolean(apiToken && token && token === apiToken);
}

async function apiTokenUser(users) {
  const userId = String(process.env.REQUIREMENTS_API_USER_ID || "").trim();
  if (!userId) return { error: "API_TOKEN_USER_NOT_CONFIGURED", message: "API Token 尚未绑定用户。" };
  const user = await users.findById(userId);
  if (!user) return { error: "API_TOKEN_USER_NOT_FOUND", message: "API Token 绑定的用户不存在。" };
  return { user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } };
}

function authMiddleware(users) {
  return async function (req, res, next) {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, code: "UNAUTHORIZED", message: "请先登录。" });
    }
    if (matchesApiToken(token)) {
      const result = await apiTokenUser(users);
      if (result.error) return res.status(401).json({ ok: false, code: result.error, message: result.message });
      req.user = result.user;
      return next();
    }
    try {
      const decoded = verifyAccess(token);
      const user = await users.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({ ok: false, code: "UNAUTHORIZED", message: "用户不存在或已被删除。" });
      }
      req.user = { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
      next();
    } catch (_err) {
      return res.status(401).json({ ok: false, code: "UNAUTHORIZED", message: "登录已过期，请重新登录。" });
    }
  };
}

function optionalAuth(users) {
  return async function (req, _res, next) {
    const token = readBearerToken(req);
    if (!token) {
      req.user = null;
      return next();
    }
    if (matchesApiToken(token)) {
      const result = await apiTokenUser(users);
      req.user = result.user || null;
      return next();
    }
    try {
      const decoded = verifyAccess(token);
      const user = await users.findById(decoded.sub);
      if (user) {
        req.user = { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
      } else {
        req.user = null;
      }
    } catch (_err) {
      req.user = null;
    }
    next();
  };
}

module.exports = { authMiddleware, optionalAuth, apiTokenUser };
