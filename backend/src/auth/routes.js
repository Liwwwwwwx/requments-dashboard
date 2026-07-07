"use strict";
const express = require("express");
const path = require("path");
const { initUsers } = require("./users");
const { signAccess, signRefresh, verifyRefresh } = require("./tokens");
const { authMiddleware } = require("./middleware");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function createAuthRoutes(rootDir) {
  const dbPath = path.join(rootDir, "data", "users.db");
  const users = initUsers(dbPath);
  const requireAuth = authMiddleware(users);
  const router = express.Router();

  router.post("/auth/login", express.json(), (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "MISSING_CREDENTIALS" });
    }
    const user = users.findByUsername(username);
    if (!user || !users.verifyPassword(user, password)) {
      return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    }
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);
    return res.json({
      ok: true,
      user: { id: user.id, username: user.username, displayName: user.display_name },
      accessToken
    });
  });

  router.post("/auth/refresh", express.json(), (req, res) => {
    const token = req.cookies && req.cookies.refresh_token;
    if (!token) {
      return res.status(401).json({ ok: false, error: "NO_REFRESH_TOKEN" });
    }
    let decoded;
    try {
      decoded = verifyRefresh(token);
    } catch (_err) {
      return res.status(401).json({ ok: false, error: "INVALID_REFRESH_TOKEN" });
    }
    const user = users.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ ok: false, error: "USER_NOT_FOUND" });
    }
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);
    return res.json({ ok: true, accessToken });
  });

  router.post("/auth/logout", (_req, res) => {
    res.clearCookie("refresh_token", { httpOnly: true, secure: COOKIE_OPTIONS.secure, sameSite: "lax", path: "/" });
    return res.json({ ok: true });
  });

  router.get("/auth/me", requireAuth, (req, res) => {
    return res.json({ ok: true, user: req.user });
  });

  router.use("/auth", (_req, res) => {
    return res.status(404).json({ ok: false, error: "AUTH_ROUTE_NOT_FOUND" });
  });

  return router;
}

module.exports = { createAuthRoutes };
