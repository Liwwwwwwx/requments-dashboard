"use strict";

const fs = require("fs");
const path = require("path");
const { validateEvent } = require("./schema");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nowMs() {
  return Date.now();
}

function createEventId() {
  return `EVT-${nowMs()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readEvents(eventsPath) {
  if (!fs.existsSync(eventsPath)) return [];
  const content = fs.readFileSync(eventsPath, "utf8");
  if (!content.trim()) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function withLock(lockPath, action) {
  ensureDir(path.dirname(lockPath));
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
      while (Date.now() < until) {} // eslint-disable-line no-empty
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

function appendEvents(eventsPath, input) {
  const list = Array.isArray(input) ? input : [input];
  if (list.length === 0) return [];

  const normalized = list.map((event) => {
    const filled = {
      eventId: event.eventId || createEventId(),
      ts: event.ts || nowMs(),
      ...event
    };
    return validateEvent(filled);
  });

  ensureDir(path.dirname(eventsPath));
  const lines = normalized.map((event) => JSON.stringify(event)).join("\n");
  fs.appendFileSync(eventsPath, `${lines}\n`, "utf8");
  return normalized;
}

module.exports = {
  readEvents,
  appendEvents,
  withLock,
  createEventId
};
