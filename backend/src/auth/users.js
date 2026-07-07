"use strict";
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const stores = new Map();

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
  const resolvedPath = path.resolve(dbPath);
  if (stores.has(resolvedPath)) {
    return stores.get(resolvedPath);
  }
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count === 0) {
    const defaultUsername = process.env.DEFAULT_USERNAME || "admin";
    const defaultPasswordHash = process.env.DEFAULT_PASSWORD_HASH || bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (id, username, password, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(
      "u1",
      defaultUsername,
      defaultPasswordHash,
      process.env.DEFAULT_DISPLAY_NAME || "管理员",
      new Date().toISOString()
    );
  }

  const store = {
    findByUsername(username) {
      const row = db.prepare("SELECT id, username, password, display_name, created_at FROM users WHERE username = ?").get(username);
      return row || null;
    },
    findById(id) {
      const row = db.prepare("SELECT id, username, password, display_name, created_at FROM users WHERE id = ?").get(id);
      return row || null;
    },
    verifyPassword(user, password) {
      return bcrypt.compareSync(password, user.password);
    }
  };
  stores.set(resolvedPath, store);
  return store;
}

module.exports = { initUsers };
