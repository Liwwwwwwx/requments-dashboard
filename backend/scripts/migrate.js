#!/usr/bin/env node
"use strict";

/**
 * 把旧 JSONL 迁到 requirements-board 的事件存储。
 * 主要变更：
 *   - type 字段改名为 kind
 *   - 给每条事件加上 project 字段
 *   - 丢弃无法校验的事件（打印警告）
 *
 * 用法：
 *   node migrate.js [--source <path>] [--target-project <id>]
 *
 * 默认 source：../REQUIREMENTS/data/events.jsonl（仓库内历史遗留路径）
 * 通过 SOURCE 环境变量或 --source 覆盖。
 */

const fs = require("fs");
const path = require("path");
const { validateEvent } = require("../src/schema");
const { ensureProject } = require("../src/projects");
const { appendEvents } = require("../src/events");
const { render } = require("../src/state");

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) flags[key] = true;
    else { flags[key] = next; i += 1; }
  }
  return flags;
}

const ROOT = process.env.REQUIREMENTS_ROOT || path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.resolve(__dirname, "../../../REQUIREMENTS/data/events.jsonl");

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const source = flags.source || process.env.SOURCE || DEFAULT_SOURCE;
  const targetProject = flags["target-project"] || process.env.TARGET_PROJECT || "default";

  if (!fs.existsSync(source)) {
    console.error(`Source file not found: ${source}`);
    console.error("请用 --source <path> 或 SOURCE 环境变量指定源 JSONL 文件。");
    process.exit(1);
  }

  const paths = ensureProject(ROOT, targetProject);

  const raw = fs.readFileSync(source, "utf8");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const events = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i += 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      const migrated = { ...parsed, project: targetProject };
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

  console.log(`\nMigrated ${events.length} event(s) to project ${targetProject}`);
  console.log(`Skipped ${skipped} invalid line(s)`);
  console.log(`Rendered ${state.items.length} requirement(s)`);
}

main();