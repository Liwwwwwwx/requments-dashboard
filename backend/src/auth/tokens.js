"use strict";
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { query } = require("../postgres");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "requirements-board-access-secret-dev";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "requirements-board-refresh-secret-dev";

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

function parseDuration(expires) {
  const match = String(expires).match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 3600 * 1000;
    case "d": return value * 86400 * 1000;
    default: return null;
  }
}

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, type: "access" },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id, type: "refresh", jti: crypto.randomUUID() },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// --- refresh token DB lifecycle ---

async function saveRefreshToken(userId, jti, family) {
  const ms = parseDuration(REFRESH_EXPIRES);
  const expiresAt = ms ? new Date(Date.now() + ms) : new Date(Date.now() + 7 * 86400 * 1000);
  await query(
    `INSERT INTO refresh_tokens (id, user_id, family, expires_at, revoked)
     VALUES ($1, $2, $3, $4, false)`,
    [jti, userId, family, expiresAt.toISOString()]
  );
}

async function revokeRefreshToken(jti) {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
    [jti]
  );
}

async function revokeTokenFamily(family) {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE family = $1`,
    [family]
  );
}

async function findRefreshToken(jti) {
  const result = await query(
    `SELECT id, user_id, family, expires_at, revoked, created_at
     FROM refresh_tokens WHERE id = $1`,
    [jti]
  );
  return result.rows[0] || null;
}

async function isFamilyCompromised(family, currentJti) {
  const result = await query(
    `SELECT 1 FROM refresh_tokens
     WHERE family = $1 AND revoked = false AND id != $2 AND created_at > (
       SELECT created_at FROM refresh_tokens WHERE id = $2
     )
     LIMIT 1`,
    [family, currentJti]
  );
  return result.rowCount > 0;
}

module.exports = {
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
  saveRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  findRefreshToken,
  isFamilyCompromised,
  ACCESS_SECRET,
  REFRESH_SECRET
};
