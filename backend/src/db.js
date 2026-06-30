"use strict";

/**
 * SQLite 存储层（事件溯源）。
 *
 * 每个项目一个独立的 SQLite 文件：data/<project>/events.db
 *
 * Schema：
 *   events(
 *     id              TEXT PRIMARY KEY,    -- eventId（用于去重 / 查找）
 *     ts              INTEGER NOT NULL,    -- 毫秒时间戳（用于排序）
 *     kind            TEXT NOT NULL,       -- req.new / req.status / task.new / ...
 *     project         TEXT,                -- 项目 id
 *     requirement_id  TEXT,                -- 所属需求
 *     task_id         TEXT,                -- 所属任务
 *     actor           TEXT,                -- 写入者
 *     payload         TEXT NOT NULL        -- 完整事件 JSON
 *   )
 *
 * payload 才是事实源，列只用来索引。读出时直接返回解析后的 payload。
 *
 * 一次性迁移：如果存在旧版 events.jsonl，会在 openDb 时自动导入并删除。
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { validateEvent } = require("./schema");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  ts              INTEGER NOT NULL,
  kind            TEXT NOT NULL,
  project         TEXT,
  requirement_id  TEXT,
  task_id         TEXT,
  actor           TEXT,
  payload         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_ts              ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_requirement    ON events(requirement_id);
CREATE INDEX IF NOT EXISTS idx_events_task           ON events(task_id);
CREATE INDEX IF NOT EXISTS idx_events_kind           ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_project_kind   ON events(project, kind);
`;

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

function readJsonlEvents(jsonlPath) {
  if (!fs.existsSync(jsonlPath)) return [];
  const content = fs.readFileSync(jsonlPath, "utf8");
  if (!content.trim()) return [];
  const events = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      events.push(validateEvent(parsed));
    } catch (err) {
      throw new Error(`Invalid JSONL at line ${i + 1}: ${err.message}`);
    }
  }
  return events;
}

/**
 * 从 events.jsonl 一次性导入到 events.db。导入后删除原文件。
 * 已经存在 SQLite 数据时跳过（不会重复导入）。
 */
function migrateFromJsonl(dbPath, jsonlPath) {
  if (!fs.existsSync(jsonlPath)) return { migrated: 0, skipped: false };
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const events = readJsonlEvents(jsonlPath);
  const db = openDb(dbPath);
  try {
    const existing = db.prepare("SELECT COUNT(*) AS n FROM events").get().n;
    if (existing > 0) {
      // 不重复导入，但保留 jsonl 等用户手动处理
      return { migrated: 0, skipped: true, existing };
    }
    const insert = db.prepare(`
      INSERT INTO events (id, ts, kind, project, requirement_id, task_id, actor, payload)
      VALUES (@id, @ts, @kind, @project, @requirement_id, @task_id, @actor, @payload)
    `);
    const insertMany = db.transaction((rows) => {
      for (const row of rows) insert.run(row);
    });
    insertMany(events.map(eventToRow));
    fs.unlinkSync(jsonlPath);
    return { migrated: events.length, skipped: false };
  } finally {
    db.close();
  }
}

function rowToEvent(row) {
  if (!row) return null;
  return JSON.parse(row.payload);
}

function eventToRow(event) {
  return {
    id: event.eventId,
    ts: event.ts,
    kind: event.kind,
    project: event.project || null,
    requirement_id: event.requirementId || null,
    task_id: event.taskId || null,
    actor: event.actor || null,
    payload: JSON.stringify(event)
  };
}

module.exports = {
  openDb,
  rowToEvent,
  eventToRow,
  readJsonlEvents,
  migrateFromJsonl,
  SCHEMA
};