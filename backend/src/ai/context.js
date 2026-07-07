"use strict";

/**
 * 上下文拼装（Sprint 3）。
 *
 * 读取当前项目的事件流 + state.json（已渲染的需求视图），把
 *   - 当前项目 / 需求元信息
 *   - 任务列表
 *   - 最近 50 条相关事件
 * 拼成 system prompt 的一部分，让 AI 在对话时拥有真实上下文。
 *
 * 物理上不会修改 events.jsonl / state.json，全部只读。
 */

const fs = require("fs");
const path = require("path");
const { projectPaths } = require("../projects");
const { readEvents } = require("../events");
const { render } = require("../state");

const MAX_EVENT_TAIL = 50;

const SYSTEM_BASE = `你是 Requirements Board 的项目级 AI 助手，帮助用户查看和推进多项目需求。
你的回答简洁、精确，使用与界面一致的中文术语。

**重要：不要直接修改看板状态**。当用户希望你「生成 / 拆解 / 推进 / 修改」时：
1. 先在文字里简短说明你打算写哪些事件、影响哪些需求/任务；
2. 通过调用 \`propose_events\` 工具返回结构化的事件列表；
3. 等待用户在前端「应用到看板」按钮确认后才会真正落库。

可用事件类型：
- req.new: 新建需求（必填：requirementId, title, summary, priority）
- req.status: 修改需求状态（必填：requirementId, status ∈ {todo, doing, blocked, done}）
- req.patch: 修改需求字段（必填：requirementId，加可选字段 title/summary/priority/owner/week/dueDate/detail/acceptance）
- task.new: 新建任务（必填：requirementId, taskId, role, title；taskId 形如 FE-1, BE-2, CONTRACT-1）
- task.status: 修改任务状态（必填：requirementId, taskId, status ∈ {todo, claimed, working, done, accepted, blocked}；可选 agent, verify, notes）
- contract.set: 设置接口契约（必填：requirementId, endpoints[]）
- note.add: 添加备注（必填：requirementId, text）
`;

function safeRender(paths) {
  try {
    if (!fs.existsSync(paths.eventsPath)) {
      return null;
    }
    return render(paths);
  } catch (_err) {
    return null;
  }
}

function eventSummary(event) {
  const kind = event.kind || event.type || "?";
  const parts = [`[${kind}]`];
  if (event.requirementId) parts.push(event.requirementId);
  if (event.taskId) parts.push(event.taskId);
  if (event.status) parts.push(`status=${event.status}`);
  if (event.title) parts.push(String(event.title).slice(0, 40));
  if (event.summary) parts.push(String(event.summary).slice(0, 60));
  if (event.text) parts.push(String(event.text).slice(0, 60));
  if (event.actor) parts.push(`@${event.actor}`);
  return parts.join(" ");
}

function buildContext({ rootDir, projectId, requirementId }) {
  const paths = projectPaths(rootDir, projectId);
  const state = safeRender(paths);
  const requirement = requirementId && state
    ? state.items.find((item) => item.id === requirementId) || null
    : null;
  const tasks = requirement?.tasks || [];

  // 事件尾
  const allEvents = state && fs.existsSync(paths.eventsPath)
    ? readEvents(paths.eventsPath)
    : [];

  let eventTail = [];
  if (requirementId) {
    const filtered = allEvents.filter((e) => e.requirementId === requirementId);
    eventTail = filtered.slice(-MAX_EVENT_TAIL);
  } else {
    eventTail = allEvents.slice(-MAX_EVENT_TAIL);
  }

  return { state, requirement, tasks, eventTail };
}

function buildSystemPrompt(rootDir, { projectId, requirementId } = {}) {
  const parts = [SYSTEM_BASE];
  if (!projectId) return parts.join("\n");

  const { requirement, tasks, eventTail } = buildContext({
    rootDir,
    projectId,
    requirementId
  });

  parts.push(`\n## 当前项目\n${projectId}`);

  if (requirement) {
    parts.push(`\n## 当前需求\n${requirement.id} · ${requirement.title || "(无标题)"}\n- 状态: ${requirement.status} / ${requirement.workflowStatus || ""}\n- 优先级: ${requirement.priority}\n- 负责人: ${requirement.owner || "未分配"}\n- 摘要: ${requirement.summary || "(无)"}`);
    if (tasks.length > 0) {
      parts.push("\n### 任务列表");
      for (const t of tasks) {
        parts.push(`- ${t.taskId} [${t.role || "general"}] ${t.status} · ${t.title || ""}${t.agent ? ` @${t.agent}` : ""}`);
      }
    }
    if (requirement.acceptance && requirement.acceptance.length > 0) {
      parts.push(`\n### 验收点\n- ${requirement.acceptance.join("\n- ")}`);
    }
    if (requirement.contract?.endpoints?.length > 0) {
      parts.push(`\n### 接口契约\n${requirement.contract.endpoints.map((e) => `- ${(e.method || "GET").toUpperCase()} ${e.path}`).join("\n")}`);
    }
  } else if (requirementId) {
    parts.push(`\n## 当前需求\n${requirementId}（未在看板中找到）`);
  }

  if (eventTail.length > 0) {
    parts.push(`\n## 最近 ${eventTail.length} 条相关事件`);
    for (const event of eventTail) {
      parts.push(`- ${eventSummary(event)}`);
    }
  }

  parts.push(`\n## 行为约束
- 一次对话只能 propose 一组相关事件（不要把无关修改打包）。
- 涉及修改/新建时，requirementId 必填；task 事件还要带 taskId。
- 解释清楚你要做什么，再调用 propose_events。
- 涉及删除/批量操作请先确认。`);

  return parts.join("\n");
}

module.exports = { buildSystemPrompt, buildContext };
