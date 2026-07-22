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

function authMiddleware(users) {
  return async function (req, res, next) {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, code: "UNAUTHORIZED", message: "请先登录。" });
    }
    if (matchesApiToken(token)) {
      req.user = { id: "api-token", username: "api-token", displayName: "API Token" };
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
      req.user = { id: "api-token", username: "api-token", displayName: "API Token" };
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

module.exports = { authMiddleware, optionalAuth };
