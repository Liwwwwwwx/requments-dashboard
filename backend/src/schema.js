"use strict";

/**
 * 事件流协议的运行时校验。
 * 兼容旧事件（字段在顶层）和新事件（可选 payload 包装）。
 */

const { z } = require("zod");

const RequirementId = z.string().regex(/^REQ-\d{1,6}$/, "requirementId 必须是 REQ-NNNN 形式");

const TaskId = z.string().regex(
  /^(CONTRACT|FE|BE|REVIEW|QA|INT|INFRA)-\d{1,4}$/,
  "taskId 必须是 <ROLE>-NN 形式"
);

const Role = z.enum([
  "contract",
  "frontend",
  "backend",
  "review",
  "qa",
  "integration",
  "infra",
  "general"
]);

const RequirementStatus = z.enum(["todo", "doing", "blocked", "done"]);
const TaskStatus = z.enum(["todo", "claimed", "working", "done", "accepted", "blocked"]);
const Priority = z.enum(["P0", "P1", "P2"]);

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须是 YYYY-MM-DD 形式");

const Endpoint = z.object({
  method: z.string().min(1).optional(),
  path: z.string().min(1),
  permission: z.string().optional(),
  reasonRequired: z.boolean().optional()
}).passthrough();

const KnownKinds = [
  "req.new",
  "req.status",
  "req.patch",
  "task.new",
  "task.status",
  "contract.set",
  "note.add"
];

const EventSchema = z.object({
  eventId: z.string().optional(),
  ts: z.number().int().positive().optional(),
  kind: z.enum(KnownKinds),
  actor: z.string().min(1).optional(),
  requirementId: z.string().optional(),
  taskId: z.string().optional(),
  project: z.string().optional()
}).passthrough();

function validateEvent(input) {
  const parsed = EventSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`事件校验失败: ${issues}`);
  }
  const event = parsed.data;

  if (event.requirementId !== undefined) {
    const r = RequirementId.safeParse(event.requirementId);
    if (!r.success) {
      throw new Error(`事件校验失败: requirementId 必须是 REQ-NNNN 形式，实际 ${event.requirementId}`);
    }
  }

  if (event.taskId !== undefined) {
    const t = TaskId.safeParse(event.taskId);
    if (!t.success) {
      throw new Error(`事件校验失败: taskId 格式不合法 (${event.taskId})`);
    }
  }

  if (event.kind.startsWith("req.") && !event.requirementId) {
    throw new Error(`事件校验失败: ${event.kind} 必须包含 requirementId`);
  }
  if (event.kind.startsWith("task.") && (!event.requirementId || !event.taskId)) {
    throw new Error(`事件校验失败: ${event.kind} 必须同时包含 requirementId 和 taskId`);
  }
  if ((event.kind === "req.new" || event.kind === "req.status" || event.kind === "req.patch") && event.status !== undefined) {
    const status = RequirementStatus.safeParse(event.status);
    if (!status.success) {
      throw new Error(`事件校验失败: status 必须是 todo / doing / blocked / done 之一，实际 ${event.status}`);
    }
  }

  return event;
}

function validateBatch(events) {
  const errors = [];
  events.forEach((event, index) => {
    try {
      validateEvent(event);
    } catch (err) {
      errors.push({ index, error: err.message });
    }
  });
  return { valid: errors.length === 0, errors };
}

function selfTest() {
  const cases = [
    { ok: true,  ev: { kind: "req.new", actor: "test", requirementId: "REQ-0001", title: "ok", summary: "ok", priority: "P1" } },
    { ok: true,  ev: { kind: "task.status", actor: "test", requirementId: "REQ-0001", taskId: "FE-1", status: "working" } },
    { ok: false, ev: { kind: "req.new", actor: "test", requirementId: "BAD-001", title: "x" } },
    { ok: false, ev: { kind: "task.status", actor: "test", requirementId: "REQ-0001", taskId: "FE-XX", status: "working" } },
    { ok: false, ev: { kind: "unknown", actor: "test", requirementId: "REQ-0001" } },
    { ok: false, ev: { kind: "req.new", actor: "test", title: "x" } }
  ];
  let pass = 0, fail = 0;
  for (const c of cases) {
    const result = validateBatch([c.ev]);
    const actual = result.valid;
    if (actual === c.ok) { pass += 1; console.log(`  ✓ ${c.ok ? "accept" : "reject"} ${c.ev.kind}`); }
    else { fail += 1; console.log(`  ✗ expected ${c.ok ? "accept" : "reject"} but got ${actual ? "accept" : "reject"}: ${c.ev.kind} (${result.errors[0]?.error || ""})`); }
  }
  console.log(`\nSchema test: ${pass} pass, ${fail} fail`);
  if (fail > 0) process.exit(1);
}

module.exports = {
  KnownKinds,
  RequirementId,
  TaskId,
  Role,
  RequirementStatus,
  TaskStatus,
  Priority,
  DateString,
  validateEvent,
  validateBatch,
  selfTest
};
