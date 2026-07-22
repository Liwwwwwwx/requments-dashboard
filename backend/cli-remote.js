#!/usr/bin/env node
"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");
const path = require("path");

const DEFAULT_BASE_URL = "http://81.70.201.94:4315";
const DEFAULT_PROJECT = "default";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_ACTOR = "Agent-A-remote";
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;

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

function baseUrl() {
  return process.env.REQUIREMENTS_BOARD_URL || DEFAULT_BASE_URL;
}

function actor() {
  return process.env.REQUIREMENTS_ACTOR || DEFAULT_ACTOR;
}

function project() {
  return process.env.REQUIREMENTS_PROJECT || DEFAULT_PROJECT;
}

function token() {
  const value = String(process.env.REQUIREMENTS_BOARD_TOKEN || "").trim();
  if (!value) throw new Error("REQUIREMENTS_BOARD_TOKEN is required");
  return value;
}

function timeoutMs() {
  const v = Number(process.env.REQUIREMENTS_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

function retries() {
  const v = Number(process.env.REQUIREMENTS_RETRIES);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_RETRIES;
}

function retryDelayMs() {
  const v = Number(process.env.REQUIREMENTS_RETRY_DELAY_MS);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_RETRY_DELAY_MS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAuthHeader() {
  return { "Authorization": `Bearer ${token()}` };
}

function request(method, urlPath, body) {
  const url = new URL(urlPath, baseUrl());
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;
  const payload = body == null ? null : JSON.stringify(body);
  const headers = {
    "X-Actor": actor(),
    "Accept": "application/json",
    ...buildAuthHeader()
  };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch (_) { /* ignore */ }
          resolve({ status: res.statusCode, body: json, text });
        });
      }
    );
    req.setTimeout(timeoutMs(), () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs()}ms`));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function requestWithRetry(method, urlPath, body) {
  const max = retries();
  const delay = retryDelayMs();
  let lastErr = null;
  for (let attempt = 0; attempt <= max; attempt += 1) {
    try {
      const res = await request(method, urlPath, body);
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Auth failed (${res.status}): ${res.text || JSON.stringify(res.body)}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < max) {
        process.stderr.write(`[retry ${attempt + 1}/${max}] ${err.message}\n`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

async function getState(proj) {
  const res = await requestWithRetry("GET", `/api/projects/${proj}/state`);
  if (res.status === 404) {
    throw new Error(`Project not found: ${proj}`);
  }
  if (res.status !== 200) {
    throw new Error(`GET state failed: ${res.status} ${res.text}`);
  }
  return res.body;
}

async function appendEvents(proj, events) {
  const res = await requestWithRetry("POST", `/api/projects/${proj}/events`, { events });
  if (res.status !== 200) {
    throw new Error(`POST events failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function triggerRender(proj) {
  const res = await requestWithRetry("POST", `/api/projects/${proj}/render`);
  if (res.status !== 200) {
    throw new Error(`POST render failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

function nowMs() { return Date.now(); }
function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function buildEventBase(kind, fields) {
  return {
    eventId: `EVT-${nowMs()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: nowMs(),
    kind,
    actor: actor(),
    updatedAt: localDate(),
    ...fields
  };
}

function splitLines(v) {
  if (v == null) return [];
  return String(v).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function normalizeArray(v) { return Array.isArray(v) ? v : []; }

function parsePositionalIdRequirement(positional) {
  return positional[1] || null;
}

async function nextRequirementId(proj) {
  const state = await getState(proj);
  const items = normalizeArray(state.items);
  const max = items.reduce((cur, it) => {
    const m = String(it.id || "").match(/^REQ-(\d+)$/);
    return m ? Math.max(cur, Number(m[1])) : cur;
  }, 0);
  return `REQ-${String(max + 1).padStart(4, "0")}`;
}

async function cmdNew(positional, flags) {
  const title = flags.title;
  const summary = flags.summary || flags.description;
  if (!title || !summary) throw new Error("`new` requires --title and --summary (or --description)");
  const proj = project();
  const reqId = await nextRequirementId(proj);
  const ev = buildEventBase("req.new", {
    project: proj,
    requirementId: reqId,
    feature: flags.feature,
    title,
    requirementType: flags.type || "工程",
    status: flags.status || "todo",
    workflowStatus: flags.workflowStatus || "ready-for-task",
    week: flags.week,
    dueDate: flags.dueDate || localDate(),
    owner: flags.owner || "需求协调 / 前端开发 / 后端开发 / 契约审查 / 测试用例",
    priority: flags.priority || "P1",
    summary,
    detail: {
      goal: flags.goal || summary,
      scope: splitLines(flags.scope),
      nonGoals: splitLines(flags.nonGoals),
      next: flags.next || ""
    },
    acceptance: splitLines(flags.acceptance),
    needsContract: false
  });
  const res = await appendEvents(proj, [ev]);
  console.log(`Created ${reqId} in project ${proj} (server items: ${res.items})`);
}

async function cmdStatus(positional, flags) {
  const reqId = parsePositionalIdRequirement(positional);
  const status = positional[2];
  if (!reqId || !status) throw new Error("`status` requires requirement id and board status");
  const proj = project();
  const ev = buildEventBase("req.status", {
    project: proj,
    requirementId: reqId,
    status,
    workflowStatus: flags.workflow || flags.workflowStatus,
    next: flags.next
  });
  const res = await appendEvents(proj, [ev]);
  console.log(`Updated ${reqId} -> ${status} (server items: ${res.items})`);
}

async function cmdTaskAdd(positional, flags) {
  const reqId = parsePositionalIdRequirement(positional);
  const taskId = positional[2];
  const role = positional[3];
  const title = flags.title || positional[4];
  if (!reqId || !taskId || !role || !title) {
    throw new Error("`task-add` requires requirement id, task id, role, and title");
  }
  const proj = project();
  const ev = buildEventBase("task.new", {
    project: proj,
    requirementId: reqId,
    taskId,
    role,
    title,
    scope: flags.scope || "",
    status: flags.status || "todo",
    owner: flags.owner || null
  });
  const res = await appendEvents(proj, [ev]);
  console.log(`Added ${taskId} (${role}) to ${reqId} (server items: ${res.items})`);
}

async function cmdTaskStatus(positional, flags) {
  const reqId = parsePositionalIdRequirement(positional);
  const taskId = positional[2];
  const status = positional[3];
  if (!reqId || !taskId || !status) {
    throw new Error("`task-status` requires requirement id, task id, and status");
  }
  const proj = project();
  const ev = buildEventBase("task.status", {
    project: proj,
    requirementId: reqId,
    taskId,
    status,
    role: flags.role,
    agent: flags.agent || null,
    verify: flags.verify || null,
    notes: flags.notes || flags.reason || null,
    files: flags.files ? String(flags.files).split(",").map((s) => s.trim()).filter(Boolean) : undefined
  });
  const res = await appendEvents(proj, [ev]);
  console.log(`Updated ${reqId}/${taskId} -> ${status} (server items: ${res.items})`);
}

async function cmdContractSet(positional, flags) {
  const reqId = parsePositionalIdRequirement(positional);
  if (!reqId) throw new Error("`contract-set` requires requirement id");
  const proj = project();
  let endpoints = [];
  if (flags.file) {
    const fs = require("fs");
    endpoints = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), flags.file), "utf8"));
  } else if (flags.endpoints) {
    endpoints = JSON.parse(flags.endpoints);
  }
  if (!Array.isArray(endpoints)) throw new Error("contract endpoints must be an array");
  const ev = buildEventBase("contract.set", {
    project: proj,
    requirementId: reqId,
    endpoints
  });
  const res = await appendEvents(proj, [ev]);
  console.log(`Set contract on ${reqId} (${endpoints.length} endpoint(s), server items: ${res.items})`);
}

async function cmdNote(positional, flags) {
  const reqId = parsePositionalIdRequirement(positional);
  const text = flags.text || positional.slice(2).join(" ");
  if (!reqId || !text) throw new Error("`note` requires requirement id and note text");
  const proj = project();
  const ev = buildEventBase("note.add", {
    project: proj,
    requirementId: reqId,
    text,
    agent: flags.agent || null,
    at: new Date().toISOString()
  });
  const res = await appendEvents(proj, [ev]);
  console.log(`Note added to ${reqId} (server items: ${res.items})`);
}

async function cmdShow(positional) {
  const reqId = parsePositionalIdRequirement(positional);
  if (!reqId) throw new Error("`show` requires requirement id");
  const proj = project();
  const state = await getState(proj);
  const item = normalizeArray(state.items).find(
    (e) => e.id === reqId || e.feature === reqId
  );
  if (!item) throw new Error(`Requirement not found: ${reqId}`);
  console.log(JSON.stringify(item, null, 2));
}

async function cmdList() {
  const proj = project();
  const state = await getState(proj);
  const items = normalizeArray(state.items);
  console.log(`Project ${proj}: ${items.length} requirement(s)`);
  items
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .forEach((it) => {
      console.log(`${it.id} | ${it.status} | ${it.workflowStatus || "-"} | ${it.title}`);
    });
}

async function cmdRender() {
  const proj = project();
  const res = await triggerRender(proj);
  console.log(`Rendered ${res.items} requirement(s) for project ${proj}`);
}

async function cmdHealth() {
  const res = await requestWithRetry("GET", "/api/health");
  if (res.status !== 200) {
    throw new Error(`Health failed: ${res.status} ${res.text}`);
  }
  console.log(JSON.stringify(res.body, null, 2));
}

function printHelp() {
  console.log(`Usage (remote CLI):
  node backend/cli-remote.js health
  node backend/cli-remote.js list
  node backend/cli-remote.js show REQ-0001
  node backend/cli-remote.js new --project default --title "..." --summary "..." [--priority P1] [--type 工程]
  node backend/cli-remote.js status --project default REQ-0001 doing [--workflow frontend-working] [--next "..."]
  node backend/cli-remote.js task-add --project default REQ-0001 FE-2 frontend "按钮交互补齐" [--scope "..."]
  node backend/cli-remote.js task-status --project default REQ-0001 FE-1 working --agent Agent-B --verify "yarn lint"
  node backend/cli-remote.js contract-set --project default REQ-0001 --endpoints '[{...}]'
  node backend/cli-remote.js note --project default REQ-0001 --text "..."
  node backend/cli-remote.js render

Env:
  REQUIREMENTS_BOARD_URL      API base URL (default: ${DEFAULT_BASE_URL})
  REQUIREMENTS_BOARD_TOKEN    Bearer token (default: hardcoded)
  REQUIREMENTS_PROJECT        project id (default: ${DEFAULT_PROJECT})
  REQUIREMENTS_ACTOR          actor name (default: ${DEFAULT_ACTOR})
  REQUIREMENTS_TIMEOUT_MS     request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  REQUIREMENTS_RETRIES        number of retries on network errors (default: ${DEFAULT_RETRIES})
  REQUIREMENTS_RETRY_DELAY_MS delay between retries in ms (default: ${DEFAULT_RETRY_DELAY_MS})`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (flags.project) process.env.REQUIREMENTS_PROJECT = flags.project;
  const cmd = positional[0];
  if (!cmd || cmd === "help" || cmd === "--help") { printHelp(); return; }

  const handlers = {
    render: () => cmdRender(),
    new: () => cmdNew(positional, flags),
    status: () => cmdStatus(positional, flags),
    "task-add": () => cmdTaskAdd(positional, flags),
    "task-status": () => cmdTaskStatus(positional, flags),
    "contract-set": () => cmdContractSet(positional, flags),
    note: () => cmdNote(positional, flags),
    show: () => cmdShow(positional),
    list: () => cmdList(),
    health: () => cmdHealth()
  };
  const handler = handlers[cmd];
  if (!handler) throw new Error(`Unknown command: ${cmd}`);
  await handler();
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
