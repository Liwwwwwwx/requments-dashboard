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
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'owner',
  display_name TEXT,
  created_at   TEXT NOT NULL
);
`;

function columnNames(db) {
  return new Set(db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
}

function ensureUserSchema(db) {
  db.exec(SCHEMA);
  const columns = columnNames(db);
  if (!columns.has("password_hash")) {
    db.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
  }
  if (!columns.has("role")) {
    db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'").run();
  }
  const nextColumns = columnNames(db);
  if (nextColumns.has("password")) {
    db.prepare(
      "UPDATE users SET password_hash = password WHERE (password_hash IS NULL OR password_hash = '') AND password IS NOT NULL"
    ).run();
  }
}

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    role: row.role || "owner",
    display_name: row.display_name,
    created_at: row.created_at
  };
}

function initUsers(dbPath) {
  const resolvedPath = path.resolve(dbPath);
  if (stores.has(resolvedPath)) {
    return stores.get(resolvedPath);
  }
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  ensureUserSchema(db);

  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count === 0) {
    const defaultUsername = process.env.DEFAULT_USERNAME || "admin";
    const defaultPasswordHash = process.env.DEFAULT_PASSWORD_HASH || bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "u1",
      defaultUsername,
      defaultPasswordHash,
      process.env.DEFAULT_ROLE || "owner",
      process.env.DEFAULT_DISPLAY_NAME || "管理员",
      new Date().toISOString()
    );
  }

  const store = {
    findByUsername(username) {
      const row = db.prepare("SELECT id, username, password_hash, role, display_name, created_at FROM users WHERE username = ?").get(username);
      return toUser(row);
    },
    findById(id) {
      const row = db.prepare("SELECT id, username, password_hash, role, display_name, created_at FROM users WHERE id = ?").get(id);
      return toUser(row);
    },
    verifyPassword(user, password) {
      return bcrypt.compareSync(password, user.password_hash);
    }
  };
  stores.set(resolvedPath, store);
  return store;
}

module.exports = { initUsers };
