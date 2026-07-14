"use strict";

/**
 * 事件存储层（SQLite 实现）。
 *
 * 公共 API 保持与原 JSONL 版本一致：
 *   - readEvents(eventsPath)
 *   - appendEvents(eventsPath, input)
 *   - withLock(lockPath, action)
 *   - createEventId()
 *
 * 物理介质：每个项目一个 SQLite 文件 events.db（WAL 模式）。
 *
 * 自动迁移：若 events.jsonl 与 events.db 共存，会先把 jsonl 导入 db 然后删除。
 */

const fs = require("fs");
const path = require("path");
const { openDb, eventToRow, rowToEvent, migrateFromJsonl } = require("./db");
const { validateEvent } = require("./schema");

function nowMs() {
  return Date.now();
}

function createEventId() {
  return `EVT-${nowMs()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureMigrated(eventsPath) {
  // 若 events.db 不存在但 events.jsonl 存在，自动导入
  if (!fs.existsSync(eventsPath)) {
    const jsonlPath = eventsPath.replace(/\.db$/, ".jsonl");
    if (fs.existsSync(jsonlPath)) {
      migrateFromJsonl(eventsPath, jsonlPath);
    }
  }
}

function readEvents(eventsPath) {
  ensureMigrated(eventsPath);
  if (!fs.existsSync(eventsPath)) return [];
  const db = openDb(eventsPath);
  try {
    const rows = db
      .prepare(
        "SELECT payload FROM events ORDER BY ts ASC, rowid ASC"
      )
      .all();
    return rows.map((row) => rowToEvent(row));
  } finally {
    db.close();
  }
}

function appendEvents(eventsPath, input) {
  const list = Array.isArray(input) ? input : [input];
  if (list.length === 0) return [];

  ensureMigrated(eventsPath);

  const normalized = list.map((event) => {
    const filled = {
      eventId: event.eventId || createEventId(),
      ts: event.ts || nowMs(),
      ...event
    };
    return validateEvent(filled);
  });

  fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
  const db = openDb(eventsPath);
  try {
    const insert = db.prepare(`
      INSERT INTO events (id, ts, kind, project, requirement_id, task_id, actor, payload)
      VALUES (@id, @ts, @kind, @project, @requirement_id, @task_id, @actor, @payload)
    `);
    const insertMany = db.transaction((rows) => {
      for (const row of rows) insert.run(row);
    });
    insertMany(normalized.map(eventToRow));
  } finally {
    db.close();
  }

  return normalized;
}

function withLock(lockPath, action) {
  // 跨进程互斥（CLI vs 服务器）：保留文件锁。
  // better-sqlite3 + WAL 已经处理单进程内的读写互斥。
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const start = Date.now();
  let fd;
  while (true) {
    try {
      fd = fs.openSync(lockPath, "wx");
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      if (Date.now() - start > 5000) {
        throw new Error(`Cannot acquire lock ${lockPath}: held by another process`);
      }
      const until = Date.now() + 50;
      while (Date.now() < until) {
        /* spin */
      }
    }
  }
  try {
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    return action();
  } finally {
    fs.closeSync(fd);
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  }
}

module.exports = {
  readEvents,
  appendEvents,
  withLock,
  createEventId
};
