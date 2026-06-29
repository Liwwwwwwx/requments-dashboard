#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { projectPaths, ensureProject } = require("./src/projects");
const { readEvents, appendEvents, withLock } = require("./src/events");
const { render } = require("./src/state");

const ROOT = process.env.REQUIREMENTS_ROOT || path.resolve(__dirname, "..");

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) { flags[key] = true; }
    else { flags[key] = next; i += 1; }
  }
  return { positional, flags };
}

function actor() {
  return process.env.REQUIREMENTS_ACTOR
    || process.env.USER
    || process.env.USERNAME
    || "cli";
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function isoWeek(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function splitLines(value) {
  if (value === undefined || value === null) return [];
  return String(value).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function normalizeArray(v) { return Array.isArray(v) ? v : []; }

function nextRequirementId(eventsPath) {
  const list = readEvents(eventsPath);
  const max = list.reduce((cur, ev) => {
    const id = ev.requirementId;
    if (!id) return cur;
    const m = String(id).match(/^REQ-(\d+)$/);
    return m ? Math.max(cur, Number(m[1])) : cur;
  }, 0);
  return `REQ-${String(max + 1).padStart(4, "0")}`;
}

const DEFAULT_OWNER = "需求协调 / 前端开发 / 后端开发 / 契约审查 / 测试用例";
const ENGINEERING_TYPE = "工程";
const DEFAULT_TASKS = [
  { taskId: "CONTRACT-1", role: "contract", title: "接口契约确认", scope: "确认 API 路径、字段、权限、错误格式和审计要求" },
  { taskId: "FE-1",        role: "frontend", title: "前端实现",    scope: "按契约完成前端页面、代理、类型和交互" },
  { taskId: "BE-1",        role: "backend",  title: "后端实现",    scope: "按契约完成后端路由、校验、服务和响应" },
  { taskId: "REVIEW-1",    role: "review",   title: "契约审查",    scope: "检查前后端字段、权限和错误码是否一致" },
  { taskId: "QA-1",        role: "qa",       title: "验收用例",    scope: "补齐手动验收路径和关键回归检查" }
];

function defaultTaskEvents(requirementId) {
  return DEFAULT_TASKS.map((t) => ({
    kind: "task.new",
    actor: actor(),
    requirementId,
    taskId: t.taskId,
    role: t.role,
    title: t.title,
    scope: t.scope,
    status: "todo",
    updatedAt: localDate()
  }));
}

function projectFromFlags(flags) {
  return flags.project || flags.p || "default";
}

function getPaths(flags) {
  const projectId = projectFromFlags(flags);
  return ensureProject(ROOT, projectId);
}

function cmdRender(flags) {
  const paths = getPaths(flags);
  const state = render(paths);
  console.log(`Rendered ${state.items.length} requirement(s) for project ${projectFromFlags(flags)}`);
}

function cmdNew(flags) {
  const title = flags.title;
  const summary = flags.summary || flags.description;
  if (!title || !summary) {
    throw new Error("`new` requires --title and --summary (or --description)");
  }
  const paths = getPaths(flags);
  const today = localDate();
  const requirementId = nextRequirementId(paths.eventsPath);
  const type = flags.type || ENGINEERING_TYPE;
  const needContract = flags.contract === true || String(flags.contract || "").toLowerCase().startsWith("y");

  const ev = {
    kind: "req.new",
    actor: actor(),
    project: projectFromFlags(flags),
    requirementId,
    title,
    feature: flags.feature,
    requirementType: type,
    status: flags.status || "todo",
    workflowStatus: flags.workflowStatus || "ready-for-task",
    week: flags.week || isoWeek(today),
    dueDate: flags.dueDate || today,
    owner: flags.owner || DEFAULT_OWNER,
    priority: flags.priority || "P1",
    summary,
    detail: {
      goal: flags.goal || summary,
      scope: splitLines(flags.scope),
      nonGoals: splitLines(flags.nonGoals),
      next: flags.next || ""
    },
    acceptance: splitLines(flags.acceptance),
    needsContract: needContract
  };

  withLock(paths.lockPath, () => {
    appendEvents(paths.eventsPath, ev);
    if (type === ENGINEERING_TYPE) {
      appendEvents(paths.eventsPath, defaultTaskEvents(requirementId));
    }
    render(paths);
  });
  console.log(`Created requirement ${requirementId} in project ${projectFromFlags(flags)}`);
}

function cmdStatus(positional, flags) {
  const requirementId = positional[1];
  const status = positional[2];
  if (!requirementId || !status) throw new Error("`status` requires requirement id and board status");
  const paths = getPaths(flags);
  const ev = {
    kind: "req.status",
    actor: actor(),
    project: projectFromFlags(flags),
    requirementId,
    status,
    workflowStatus: flags.workflow || flags.workflowStatus,
    next: flags.next,
    updatedAt: localDate()
  };
  withLock(paths.lockPath, () => {
    appendEvents(paths.eventsPath, ev);
    render(paths);
  });
  console.log(`Updated ${requirementId} -> ${status}`);
}

function cmdTaskAdd(positional, flags) {
  const requirementId = positional[1];
  const taskId = positional[2];
  const role = positional[3];
  const title = flags.title || positional[4];
  if (!requirementId || !taskId || !role || !title) {
    throw new Error("`task-add` requires requirement id, task id, role, and title");
  }
  const paths = getPaths(flags);
  const ev = {
    kind: "task.new",
    actor: actor(),
    project: projectFromFlags(flags),
    requirementId,
    taskId,
    role,
    title,
    scope: flags.scope || "",
    status: flags.status || "todo",
    owner: flags.owner || null,
    updatedAt: localDate()
  };
  withLock(paths.lockPath, () => {
    appendEvents(paths.eventsPath, ev);
    render(paths);
  });
  console.log(`Added ${taskId} (${role}) to ${requirementId}`);
}

function cmdTaskStatus(positional, flags) {
  const requirementId = positional[1];
  const taskId = positional[2];
  const status = positional[3];
  if (!requirementId || !taskId || !status) {
    throw new Error("`task-status` requires requirement id, task id, and status");
  }
  const paths = getPaths(flags);
  const ev = {
    kind: "task.status",
    actor: actor(),
    project: projectFromFlags(flags),
    requirementId,
    taskId,
    status,
    role: flags.role,
    agent: flags.agent || null,
    verify: flags.verify || null,
    notes: flags.notes || flags.reason || null,
    files: flags.files ? String(flags.files).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    updatedAt: localDate()
  };
  withLock(paths.lockPath, () => {
    appendEvents(paths.eventsPath, ev);
    render(paths);
  });
  console.log(`Updated ${requirementId}/${taskId} -> ${status}`);
}

function cmdContractSet(positional, flags) {
  const requirementId = positional[1];
  if (!requirementId) throw new Error("`contract-set` requires requirement id");
  let endpoints = [];
  if (flags.file) {
    endpoints = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), flags.file), "utf8"));
  } else if (flags.endpoints) {
    endpoints = JSON.parse(flags.endpoints);
  }
  if (!Array.isArray(endpoints)) throw new Error("contract endpoints must be an array");
  const paths = getPaths(flags);
  const ev = {
    kind: "contract.set",
    actor: actor(),
    project: projectFromFlags(flags),
    requirementId,
    endpoints,
    updatedAt: localDate()
  };
  withLock(paths.lockPath, () => {
    appendEvents(paths.eventsPath, ev);
    render(paths);
  });
  console.log(`Set contract on ${requirementId} (${endpoints.length} endpoint(s))`);
}

function cmdNote(positional, flags) {
  const requirementId = positional[1];
  const text = flags.text || positional.slice(2).join(" ");
  if (!requirementId || !text) throw new Error("`note` requires requirement id and note text");
  const paths = getPaths(flags);
  const ev = {
    kind: "note.add",
    actor: actor(),
    project: projectFromFlags(flags),
    requirementId,
    text,
    agent: flags.agent || null,
    at: new Date().toISOString(),
    updatedAt: localDate()
  };
  withLock(paths.lockPath, () => {
    appendEvents(paths.eventsPath, ev);
    render(paths);
  });
  console.log(`Note added to ${requirementId}`);
}

function cmdShow(positional, flags) {
  const requirementId = positional[1];
  if (!requirementId) throw new Error("`show` requires requirement id");
  const paths = getPaths(flags);
  if (!fs.existsSync(paths.stateJsonPath)) render(paths);
  const state = JSON.parse(fs.readFileSync(paths.stateJsonPath, "utf8"));
  const item = normalizeArray(state.items).find(
    (e) => e.id === requirementId || e.feature === requirementId
  );
  if (!item) throw new Error(`Requirement not found: ${requirementId}`);
  console.log(JSON.stringify(item, null, 2));
}

function printHelp() {
  console.log(`Usage:
  node backend/cli.js render [--project default]
  node backend/cli.js new --project default --title "..." --summary "..." [--priority P1] [--type 工程]
  node backend/cli.js status --project default REQ-0001 doing [--workflow frontend-working] [--next "..."]
  node backend/cli.js task-add --project default REQ-0001 FE-2 frontend "按钮交互补齐" [--scope "..."]
  node backend/cli.js task-status --project default REQ-0001 FE-1 working --agent Agent-B --verify "yarn lint"
  node backend/cli.js contract-set --project default REQ-0001 --endpoints '[{...}]'
  node backend/cli.js note --project default REQ-0001 --text "blocked by contract"
  node backend/cli.js show --project default REQ-0001

Env:
  REQUIREMENTS_ROOT   数据根目录（默认：backend/ 目录）
  REQUIREMENTS_ACTOR  写入者（默认：当前用户）`);
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const cmd = positional[0];
  if (!cmd || cmd === "help" || cmd === "--help") { printHelp(); return; }

  const handlers = {
    render: () => cmdRender(flags),
    new: () => cmdNew(flags),
    status: () => cmdStatus(positional, flags),
    "task-add": () => cmdTaskAdd(positional, flags),
    "task-status": () => cmdTaskStatus(positional, flags),
    "contract-set": () => cmdContractSet(positional, flags),
    note: () => cmdNote(positional, flags),
    show: () => cmdShow(positional, flags)
  };
  const handler = handlers[cmd];
  if (!handler) throw new Error(`Unknown command: ${cmd}`);
  handler();
}

try {
  main();
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
