"use strict";

const store = require("../postgres-store");
const { buildState } = require("../state");
const MAX_EVENT_TAIL = 50;
const MAX_REQUIREMENT_SUMMARY = 30;
const CONTEXT_EVENT_KINDS = new Set(["req.new", "req.status", "req.patch", "note.add"]);
const SYSTEM_BASE = "你是 Requirements Board 的项目级 AI 助手，帮助用户查看和推进多项目需求。回答简洁、精确，使用中文。修改看板时必须先通过 propose_events 生成 req.status、req.patch 或 note.add，并等待用户确认应用。不要直接新建需求、任务或接口契约事件。";
function eventSummary(event) { return [`[${event.kind || "?"}]`, event.requirementId, event.status && `status=${event.status}`, event.title, event.summary, event.text, event.actor && `@${event.actor}`].filter(Boolean).map(String).join(" ").slice(0, 160); }
async function buildContext({ projectId, requirementId }) { const [project, events] = await Promise.all([store.getProjectById(projectId), store.listEvents(projectId)]); const state = buildState(events); const requirement = requirementId ? state.items.find((item) => item.id === requirementId) || null : null; const eventTail = events.filter((event) => CONTEXT_EVENT_KINDS.has(event.kind) && (!requirementId || event.requirementId === requirementId)).slice(-MAX_EVENT_TAIL); return { project, state, requirement, eventTail }; }
async function buildSystemPrompt(_rootDir, { projectId, requirementId } = {}) { if (!projectId) return SYSTEM_BASE; const { project, state, requirement, eventTail } = await buildContext({ projectId, requirementId }); const parts=[SYSTEM_BASE, `\n## 当前项目\n${project ? `${project.id} · ${project.name}` : projectId}`]; if (!requirementId) { const items=state.items.slice(0,MAX_REQUIREMENT_SUMMARY); if(items.length) parts.push(`\n## 项目需求概览\n${items.map((item)=>`- ${item.id} · ${item.title} · 状态=${item.status} · 优先级=${item.priority}`).join("\n")}`); } if(requirement) parts.push(`\n## 当前需求\n${requirement.id} · ${requirement.title}\n- 状态: ${requirement.status}\n- 优先级: ${requirement.priority}\n- 负责人: ${requirement.owner || "未分配"}\n- 摘要: ${requirement.summary || "(无)"}`); if(eventTail.length) parts.push(`\n## 最近事件\n${eventTail.map((event)=>`- ${eventSummary(event)}`).join("\n")}`); return parts.join("\n"); }
module.exports={buildSystemPrompt,buildContext};
