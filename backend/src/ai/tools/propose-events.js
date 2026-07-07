"use strict";

/**
 * propose_events 工具定义 + 校验。
 *
 * 用法：模型在一次回复中调用此工具，参数 events: [...]，每个事件符合现有 schema。
 * 写入 ai_proposals 表（不直接写项目事实事件），由用户在前端确认后 apply。
 */

const { validateEvent } = require("../../schema");

const ALLOWED_PROPOSAL_KINDS = new Set(["req.status", "req.patch", "note.add"]);
const ALLOWED_REQUIREMENT_STATUSES = new Set(["todo", "doing", "blocked", "done"]);
const ALLOWED_PRIORITIES = new Set(["P0", "P1", "P2"]);

const PROPOSE_EVENTS_TOOL = {
  type: "function",
  function: {
    name: "propose_events",
    description: "建议向看板写入一组事件。当前只生成建议，必须由用户在前端确认后才真正落库。",
    parameters: {
      type: "object",
      properties: {
        rationale: {
          type: "string",
          description: "用一句话说明你打算做什么、对哪个需求有影响"
        },
        events: {
          type: "array",
          description: "要建议写入的需求级事件列表，只允许 req.status / req.patch / note.add",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: [
                  "req.status",
                  "req.patch",
                  "note.add"
                ]
              },
              requirementId: { type: "string" },
              status: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              priority: { type: "string", enum: ["P0", "P1", "P2"] },
              owner: { type: "string" },
              text: { type: "string" },
              detail: { type: "object" },
              acceptance: { type: "array" }
            },
            required: ["kind"],
            additionalProperties: true
          }
        }
      },
      required: ["events"]
    }
  }
};

/**
 * 校验模型 propose 的事件，确保它们能通过 schema.js 的运行时校验。
 * 返回 { valid: boolean, events?: any[], errors?: string[] }
 */
function validateProposedEvents(events) {
  if (!Array.isArray(events)) {
    return { valid: false, errors: ["events 必须是数组"] };
  }
  const errors = [];
  const cleaned = [];
  for (let i = 0; i < events.length; i += 1) {
    const raw = events[i];
    if (!raw || typeof raw !== "object") {
      errors.push(`events[${i}] 不是对象`);
      continue;
    }
    // 不在这里改 actor —— 由 apply 阶段用真实 user 拼 `ai:<userId>`
    if (!ALLOWED_PROPOSAL_KINDS.has(raw.kind)) {
      errors.push(`events[${i}]: 不允许的提案事件类型 ${raw.kind}`);
      continue;
    }
    if (raw.kind === "req.status" && !ALLOWED_REQUIREMENT_STATUSES.has(raw.status)) {
      errors.push(`events[${i}]: req.status 必须包含合法 status`);
      continue;
    }
    if (raw.kind === "req.patch") {
      if (raw.title !== undefined && !String(raw.title || "").trim()) {
        errors.push(`events[${i}]: req.patch.title 不能为空`);
        continue;
      }
      if (raw.status !== undefined && !ALLOWED_REQUIREMENT_STATUSES.has(raw.status)) {
        errors.push(`events[${i}]: req.patch.status 必须是 todo / doing / blocked / done 之一`);
        continue;
      }
      if (raw.priority !== undefined && !ALLOWED_PRIORITIES.has(raw.priority)) {
        errors.push(`events[${i}]: req.patch.priority 必须是 P0 / P1 / P2 之一`);
        continue;
      }
    }
    if (raw.kind === "note.add" && !String(raw.text || "").trim()) {
      errors.push(`events[${i}]: note.add 必须包含 text`);
      continue;
    }
    try {
      const validated = validateEvent(raw);
      cleaned.push(validated);
    } catch (err) {
      errors.push(`events[${i}]: ${err.message}`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors, events: cleaned };
  }
  return { valid: true, events: cleaned };
}

module.exports = { PROPOSE_EVENTS_TOOL, validateProposedEvents, ALLOWED_PROPOSAL_KINDS };
