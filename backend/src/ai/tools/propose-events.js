"use strict";

/**
 * propose_events 工具定义 + 校验。
 *
 * 用法：模型在一次回复中调用此工具，参数 events: [...]，每个事件符合现有 schema。
 * 写入 ai_proposals 表（不直接写 events.jsonl），由用户在前端确认后 apply。
 */

const { validateEvent } = require("../../schema");

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
          description: "用一句话说明你打算做什么、对哪个需求/任务有影响"
        },
        events: {
          type: "array",
          description: "要写入的事件列表，每条与 events.jsonl 同构（kind / requirementId / taskId / 字段…）",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: [
                  "req.new",
                  "req.status",
                  "req.patch",
                  "task.new",
                  "task.status",
                  "contract.set",
                  "note.add"
                ]
              },
              requirementId: { type: "string" },
              taskId: { type: "string" },
              status: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              priority: { type: "string", enum: ["P0", "P1", "P2"] },
              owner: { type: "string" },
              week: { type: "string" },
              dueDate: { type: "string" },
              text: { type: "string" },
              agent: { type: "string" },
              verify: { type: "string" },
              notes: { type: "string" },
              role: { type: "string" },
              endpoints: { type: "array" },
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

module.exports = { PROPOSE_EVENTS_TOOL, validateProposedEvents };
