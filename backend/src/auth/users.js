"use strict";
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  display_name TEXT,
  created_at   TEXT NOT NULL
);
`;

function initUsers(dbPath) {
  if (db) {
    return { findByUsername, findById, verifyPassword, createUser, updatePassword };
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count === 0) {
    db.prepare("INSERT INTO users (id, username, password, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(
      "u1",
      "admin",
      bcrypt.hashSync("admin123", 10),
      "管理员",
      new Date().toISOString()
    );
  }

  return { findByUsername, findById, verifyPassword, createUser, updatePassword };
}

function findByUsername(username) {
  const row = db.prepare("SELECT id, username, password, display_name, created_at FROM users WHERE username = ?").get(username);
  return row || null;
}

function findById(id) {
  const row = db.prepare("SELECT id, username, password, display_name, created_at FROM users WHERE id = ?").get(id);
  return row || null;
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

function createUser(username, password, displayName) {
  const existing = findByUsername(username);
  if (existing) return null;
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, username, password, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(id, username, hash, displayName || username, now);
  return findById(id);
}

function updatePassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, userId);
  return true;
}

module.exports = { initUsers };
