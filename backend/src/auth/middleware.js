"use strict";
const { verifyAccess } = require("./tokens");

function authMiddleware(users) {
  return function (req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const token = header.slice(7);
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
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }
    const token = header.slice(7);
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
