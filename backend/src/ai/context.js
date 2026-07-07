"use strict";

/**
 * 上下文拼装。
 *
 * 读取当前项目的 SQLite 事件 + 已渲染需求视图，把
 *   - 当前项目 / 需求元信息
 *   - 最近 50 条相关事件
 * 拼成 system prompt 的一部分，让 AI 在对话时拥有真实上下文。
 *
 * 这里只读项目数据，不直接写入事实事件。
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
1. 先在文字里简短说明你打算写哪些事件、影响哪些需求；
2. 通过调用 \`propose_events\` 工具返回结构化的事件列表；
3. 等待用户在前端「应用到看板」按钮确认后才会真正落库。

可用事件类型：
- req.status: 修改需求状态（必填：requirementId, status ∈ {todo, doing, blocked, done}）
- req.patch: 修改需求字段（必填：requirementId，加可选字段 title/summary/priority/owner/detail/acceptance）
- note.add: 添加备注（必填：requirementId, text）

不要提议新建需求、任务事件、接口契约事件或其他非 V2 MVP 事件。需要新建需求时，只生成文字版需求草稿。
`;

const CONTEXT_EVENT_KINDS = new Set(["req.new", "req.status", "req.patch", "note.add"]);

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

  // 事件尾
  const allEvents = state && fs.existsSync(paths.eventsPath)
    ? readEvents(paths.eventsPath)
    : [];

  let eventTail = [];
  if (requirementId) {
    const filtered = allEvents.filter((e) =>
      e.requirementId === requirementId && CONTEXT_EVENT_KINDS.has(e.kind)
    );
    eventTail = filtered.slice(-MAX_EVENT_TAIL);
  } else {
    eventTail = allEvents.filter((e) => CONTEXT_EVENT_KINDS.has(e.kind)).slice(-MAX_EVENT_TAIL);
  }

  return { state, requirement, eventTail };
}

function buildSystemPrompt(rootDir, { projectId, requirementId } = {}) {
  const parts = [SYSTEM_BASE];
  if (!projectId) return parts.join("\n");

  const { requirement, eventTail } = buildContext({
    rootDir,
    projectId,
    requirementId
  });

  parts.push(`\n## 当前项目\n${projectId}`);

  if (requirement) {
    parts.push(`\n## 当前需求\n${requirement.id} · ${requirement.title || "(无标题)"}\n- 状态: ${requirement.status}\n- 优先级: ${requirement.priority}\n- 负责人: ${requirement.owner || "未分配"}\n- 摘要: ${requirement.summary || "(无)"}`);
    if (requirement.acceptance && requirement.acceptance.length > 0) {
      parts.push(`\n### 验收点\n- ${requirement.acceptance.join("\n- ")}`);
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
- 涉及修改时，requirementId 必填；不要提议新建需求或任务事件。
- 解释清楚你要做什么，再调用 propose_events。
- 涉及删除/批量操作请先确认。`);

  return parts.join("\n");
}

module.exports = { buildSystemPrompt, buildContext };
