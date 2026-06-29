#!/usr/bin/env node
"use strict";

/**
 * 把旧 REQUIREMENTS/data/events.jsonl 迁到 requirements-board/backend/data/default/events.jsonl
 * 主要变更：
 *   - type 字段改名为 kind
 *   - 给每条事件加上 project: "default"
 *   - 丢弃无法校验的事件（打印警告）
 */

const fs = require("fs");
const path = require("path");
const { validateEvent } = require("../src/schema");
const { ensureProject } = require("../src/projects");
const { appendEvents } = require("../src/events");
const { render } = require("../src/state");

const SOURCE = path.resolve(__dirname, "../../../REQUIREMENTS/data/events.jsonl");
const ROOT = process.env.REQUIREMENTS_ROOT || path.resolve(__dirname, "..");
const TARGET_PROJECT = process.env.TARGET_PROJECT || "default";

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source file not found: ${SOURCE}`);
    process.exit(1);
  }

  const paths = ensureProject(ROOT, TARGET_PROJECT);

  const raw = fs.readFileSync(SOURCE, "utf8");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const events = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i += 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      const migrated = {
        ...parsed,
        project: TARGET_PROJECT
      };
      if (migrated.type !== undefined && migrated.kind === undefined) {
        migrated.kind = migrated.type;
        delete migrated.type;
      }
      validateEvent(migrated);
      events.push(migrated);
    } catch (err) {
      skipped += 1;
      console.warn(`Skip line ${i + 1}: ${err.message}`);
    }
  }

  if (fs.existsSync(paths.eventsPath)) {
    console.error(`Target already exists: ${paths.eventsPath}. Abort to avoid overwrite.`);
    process.exit(1);
  }

  appendEvents(paths.eventsPath, events);
  const state = render(paths);

  console.log(`\nMigrated ${events.length} event(s) to project ${TARGET_PROJECT}`);
  console.log(`Skipped ${skipped} invalid line(s)`);
  console.log(`Rendered ${state.items.length} requirement(s)`);
}

main();
