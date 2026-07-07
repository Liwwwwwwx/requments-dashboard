"use strict";

/**
 * AI 模块的 SQLite 存储层。
 *
 * 复用 events.js 中已有的 openDb 设施，在同一个 events.db 里新增三张表：
 *   - ai_conversations
 *   - ai_messages
 *   - ai_proposals
 *
 * 关键原则：AI 对话本身不写入事实事件表，不污染项目需求状态。
 */

const path = require("path");
const { openDb } = require("../db");

function ensureAiSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      project_id      TEXT NOT NULL,
      requirement_id  TEXT,
      title           TEXT,
      model           TEXT NOT NULL,
      account_id      TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      tool_calls      TEXT,
      tokens_in       INTEGER NOT NULL DEFAULT 0,
      tokens_out      INTEGER NOT NULL DEFAULT 0,
      ts              INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_proposals (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      message_id      TEXT NOT NULL,
      events_json     TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      applied_at      INTEGER,
      applied_by      TEXT,
      created_at      INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_msg_conv
      ON ai_messages(conversation_id, ts ASC);
    CREATE INDEX IF NOT EXISTS idx_ai_prop_conv
      ON ai_proposals(conversation_id);
  `);
}

function nowMs() {
  return Date.now();
}

function createId(prefix) {
  return `${prefix}-${nowMs()}-${Math.random().toString(36).slice(2, 8)}`;
}

function openAiDb(rootDir, projectId) {
  // 每个项目一个 events.db；AI 表与现有事件表共存
  const safe = String(projectId || "default").replace(/[^a-zA-Z0-9_-]/g, "-");
  const dbPath = path.join(rootDir, "data", safe, "events.db");
  const db = openDb(dbPath);
  ensureAiSchema(db);
  return db;
}

function createConversation(rootDir, projectId, input) {
  const db = openAiDb(rootDir, projectId);
  try {
    const conv = {
      id: input.id || createId("CONV"),
      user_id: String(input.userId || "anonymous"),
      project_id: String(projectId),
      requirement_id: input.requirementId || null,
      title: input.title || null,
      model: String(input.model || "deepseek-chat"),
      account_id: input.accountId || null,
      created_at: nowMs(),
      updated_at: nowMs()
    };
    db.prepare(`
      INSERT INTO ai_conversations
        (id, user_id, project_id, requirement_id, title, model, account_id, created_at, updated_at)
      VALUES (@id, @user_id, @project_id, @requirement_id, @title, @model, @account_id, @created_at, @updated_at)
    `).run(conv);
    return conv;
  } finally {
    db.close();
  }
}

function getConversation(rootDir, projectId, conversationId) {
  const db = openAiDb(rootDir, projectId);
  try {
    const conv = db
      .prepare("SELECT * FROM ai_conversations WHERE id = ?")
      .get(conversationId);
    if (!conv) return null;
    return rowToConversation(conv);
  } finally {
    db.close();
  }
}

function listConversations(rootDir, projectId, { userId, limit = 50 } = {}) {
  const db = openAiDb(rootDir, projectId);
  try {
    const rows = userId
      ? db
          .prepare(
            "SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?"
          )
          .all(userId, limit)
      : db
          .prepare(
            "SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT ?"
          )
          .all(limit);
    return rows.map(rowToConversation);
  } finally {
    db.close();
  }
}

function touchConversation(rootDir, projectId, conversationId) {
  const db = openAiDb(rootDir, projectId);
  try {
    db.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").run(
      nowMs(),
      conversationId
    );
  } finally {
    db.close();
  }
}

/**
 * 自动生成会话标题（基于首条 user 消息）。
 * 仅在当前 title 为空时被设置，已存在的 title 不会被覆盖（用户可手动改）。
 */
function autoTitleFromText(text) {
  const trimmed = String(text || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const max = 30;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + "…";
}

function setConversationTitleIfEmpty(rootDir, projectId, conversationId, candidate) {
  if (!candidate) return false;
  const db = openAiDb(rootDir, projectId);
  try {
    const res = db
      .prepare(
        "UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ? AND (title IS NULL OR title = '')"
      )
      .run(candidate, nowMs(), conversationId);
    return res.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * 用户手动改名（强制覆盖）。
 * 重名校验放在 routes 层调用，这里只负责写入。
 */
function renameConversation(rootDir, projectId, conversationId, newTitle) {
  const trimmed = String(newTitle || "").trim();
  if (!trimmed) throw new Error("TITLE_EMPTY");
  const db = openAiDb(rootDir, projectId);
  try {
    const res = db
      .prepare("UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(trimmed, nowMs(), conversationId);
    return res.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * 在某项目下查找同名（不区分大小写 / 忽略空白）会话。
 * 返回除 excludeId 之外的命中。
 */
function findDuplicateTitle(rootDir, projectId, title, excludeId, userId) {
  const trimmed = String(title || "").trim().toLowerCase();
  if (!trimmed) return null;
  const db = openAiDb(rootDir, projectId);
  try {
    if (userId) {
      const rows = db
        .prepare(
          excludeId
            ? "SELECT id, title FROM ai_conversations WHERE user_id = ? AND id != ? AND lower(trim(title)) = ?"
            : "SELECT id, title FROM ai_conversations WHERE user_id = ? AND lower(trim(title)) = ?"
        )
        .all(...(excludeId ? [userId, excludeId, trimmed] : [userId, trimmed]));
      return rows[0] || null;
    }
    const rows = db
      .prepare(
        excludeId
          ? "SELECT id, title FROM ai_conversations WHERE id != ? AND lower(trim(title)) = ?"
          : "SELECT id, title FROM ai_conversations WHERE lower(trim(title)) = ?"
      )
      .all(...(excludeId ? [excludeId, trimmed] : [trimmed]));
    return rows[0] || null;
  } finally {
    db.close();
  }
}

/**
 * 删除会话及其所有消息 / 提案。
 * 返回 { messages, proposals } 删除条数。
 */
function deleteConversation(rootDir, projectId, conversationId) {
  const db = openAiDb(rootDir, projectId);
  try {
    const tx = db.transaction(() => {
      const m = db
        .prepare("DELETE FROM ai_messages WHERE conversation_id = ?")
        .run(conversationId);
      const p = db
        .prepare("DELETE FROM ai_proposals WHERE conversation_id = ?")
        .run(conversationId);
      const c = db
        .prepare("DELETE FROM ai_conversations WHERE id = ?")
        .run(conversationId);
      return { messages: m.changes, proposals: p.changes, conversations: c.changes };
    });
    return tx();
  } finally {
    db.close();
  }
}

function rowToConversation(row) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    requirementId: row.requirement_id,
    title: row.title,
    model: row.model,
    accountId: row.account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function appendMessage(rootDir, projectId, input) {
  const db = openAiDb(rootDir, projectId);
  try {
    const msg = {
      id: input.id || createId("MSG"),
      conversation_id: String(input.conversationId),
      role: String(input.role),
      content: String(input.content || ""),
      tool_calls: input.toolCalls ? JSON.stringify(input.toolCalls) : null,
      tokens_in: Number(input.tokensIn) || 0,
      tokens_out: Number(input.tokensOut) || 0,
      ts: input.ts || nowMs()
    };
    db.prepare(`
      INSERT INTO ai_messages
        (id, conversation_id, role, content, tool_calls, tokens_in, tokens_out, ts)
      VALUES (@id, @conversation_id, @role, @content, @tool_calls, @tokens_in, @tokens_out, @ts)
    `).run(msg);
    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null,
      tokensIn: msg.tokens_in,
      tokensOut: msg.tokens_out,
      ts: msg.ts
    };
  } finally {
    db.close();
  }
}

/**
 * 覆写一条已存在消息的内容与 token（用于流式：先 INSERT 占位，流结束后再 UPDATE 填全文）。
 */
function updateMessageContent(rootDir, projectId, messageId, patch) {
  const db = openAiDb(rootDir, projectId);
  try {
    const existing = db
      .prepare("SELECT * FROM ai_messages WHERE id = ?")
      .get(messageId);
    if (!existing) return null;
    const next = {
      content: patch.content !== undefined ? String(patch.content) : existing.content,
      tokens_in: patch.tokensIn !== undefined ? Number(patch.tokensIn) || 0 : existing.tokens_in,
      tokens_out: patch.tokensOut !== undefined ? Number(patch.tokensOut) || 0 : existing.tokens_out
    };
    db.prepare(
      "UPDATE ai_messages SET content = ?, tokens_in = ?, tokens_out = ? WHERE id = ?"
    ).run(next.content, next.tokens_in, next.tokens_out, messageId);
    return {
      id: messageId,
      conversationId: existing.conversation_id,
      role: existing.role,
      content: next.content,
      tokensIn: next.tokens_in,
      tokensOut: next.tokens_out,
      ts: existing.ts
    };
  } finally {
    db.close();
  }
}

function listMessages(rootDir, projectId, conversationId) {
  const db = openAiDb(rootDir, projectId);
  try {
    const rows = db
      .prepare("SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY ts ASC")
      .all(conversationId);
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      ts: row.ts
    }));
  } finally {
    db.close();
  }
}

function createProposal(rootDir, projectId, input) {
  const db = openAiDb(rootDir, projectId);
  try {
    const prop = {
      id: input.id || createId("PROP"),
      conversation_id: String(input.conversationId),
      message_id: String(input.messageId),
      events_json: JSON.stringify(input.events || []),
      status: "pending",
      applied_at: null,
      applied_by: null,
      created_at: nowMs()
    };
    db.prepare(`
      INSERT INTO ai_proposals
        (id, conversation_id, message_id, events_json, status, applied_at, applied_by, created_at)
      VALUES (@id, @conversation_id, @message_id, @events_json, @status, @applied_at, @applied_by, @created_at)
    `).run(prop);
    return {
      id: prop.id,
      conversationId: prop.conversation_id,
      messageId: prop.message_id,
      events: input.events || [],
      status: "pending",
      createdAt: prop.created_at
    };
  } finally {
    db.close();
  }
}

function getProposal(rootDir, projectId, proposalId) {
  const db = openAiDb(rootDir, projectId);
  try {
    const row = db
      .prepare("SELECT * FROM ai_proposals WHERE id = ?")
      .get(proposalId);
    if (!row) return null;
    return rowToProposal(row);
  } finally {
    db.close();
  }
}

function listProposals(rootDir, projectId, conversationId) {
  const db = openAiDb(rootDir, projectId);
  try {
    const rows = db
      .prepare("SELECT * FROM ai_proposals WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId);
    return rows.map(rowToProposal);
  } finally {
    db.close();
  }
}

function markProposalApplied(rootDir, projectId, proposalId, appliedBy) {
  const db = openAiDb(rootDir, projectId);
  try {
    db.prepare(
      "UPDATE ai_proposals SET status = 'applied', applied_at = ?, applied_by = ? WHERE id = ?"
    ).run(nowMs(), String(appliedBy || "anonymous"), proposalId);
  } finally {
    db.close();
  }
}

function rowToProposal(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    events: row.events_json ? JSON.parse(row.events_json) : [],
    status: row.status,
    appliedAt: row.applied_at,
    appliedBy: row.applied_by,
    createdAt: row.created_at
  };
}

module.exports = {
  openAiDb,
  createConversation,
  getConversation,
  listConversations,
  touchConversation,
  autoTitleFromText,
  setConversationTitleIfEmpty,
  renameConversation,
  findDuplicateTitle,
  deleteConversation,
  appendMessage,
  updateMessageContent,
  listMessages,
  createProposal,
  getProposal,
  listProposals,
  markProposalApplied
};
