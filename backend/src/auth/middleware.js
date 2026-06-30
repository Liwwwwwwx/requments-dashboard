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
  return function (req, res, next) {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    if (matchesApiToken(token)) {
      req.user = { id: "api-token", username: "api-token", displayName: "API Token" };
      return next();
    }
    try {
      const decoded = verifyAccess(token);
      const user = users.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      }
      req.user = { id: user.id, username: user.username, displayName: user.display_name };
      next();
    } catch (_err) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
  };
}

function optionalAuth(users) {
  return function (req, _res, next) {
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
      const user = users.findById(decoded.sub);
      if (user) {
        req.user = { id: user.id, username: user.username, displayName: user.display_name };
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
