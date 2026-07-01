"use strict";

/**
 * AI 对话 API。
 *
 *   GET  /api/ai/providers
 *   GET  /api/ai/accounts
 *   POST /api/ai/conversations?project=...
 *   GET  /api/ai/conversations?project=...
 *   GET  /api/ai/conversations/:id?project=...
 *   POST /api/ai/conversations/:id/messages/stream?project=...    (SSE, 主用)
 *   POST /api/ai/conversations/:id/messages?project=...           (同步, 兼容 / CLI 友好)
 *   GET  /api/ai/conversations/:id/proposals?project=...          (Sprint 3)
 *   POST /api/ai/proposals/:id/apply?project=...                  (Sprint 3)
 */

const express = require("express");
const { chatUsageTotals, readAccounts } = require("../ai-usage/store");
const { pickProvider, selectAccount } = require("./provider");
const store = require("./store");
const { buildSystemPrompt } = require("./context");
const { streamMessage, isValidProjectId } = require("./stream");
const sse = require("./sse");
const { projectPaths } = require("../projects");
const { appendEvents, withLock } = require("../events");
const { render } = require("../state");
const { httpError } = require("../errors");
const { createRateLimiter } = require("./rate-limit");

function getCurrentUser(req) {
  return req.user || { id: "anonymous", username: "anonymous", displayName: "Anonymous" };
}

function readProjectId(req) {
  return String(req.query.project || req.body?.projectId || "").trim();
}

function createAiRoutes(rootDir) {
  const router = express.Router();
  const messageLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

  router.get("/providers", (_req, res) => {
    res.json({ ok: true, providers: ["deepseek"], default: "deepseek" });
  });

  router.get("/accounts", (_req, res) => {
    const accounts = readAccounts(rootDir).filter(
      (a) => a.provider === "deepseek" && a.enabled !== false
    );
    res.json({
      ok: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        baseUrl: a.baseUrl,
        modelId: a.modelId,
        hasApiKey: Boolean(a.apiKey)
      }))
    });
  });

  // Sprint 4：chat 调用 token 聚合（last 24h / last 7d）
  router.get("/usage", (req, res, next) => {
    try {
      const range = String(req.query.range || "24h");
      const hours = range === "7d" ? 24 * 7 : 24;
      const sinceMs = Date.now() - hours * 3600 * 1000;
      const totals = chatUsageTotals(rootDir, { sinceMs });
      res.json({ ok: true, range, hours, ...totals });
    } catch (err) {
      next(httpError(500, "AI_USAGE_TOTALS_FAILED", err.message));
    }
  });

  router.post("/conversations", express.json(), (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const user = getCurrentUser(req);
      const conv = store.createConversation(rootDir, projectId, {
        userId: user.id,
        requirementId: req.body?.requirementId || null,
        title: req.body?.title || null,
        model: req.body?.model || "deepseek-chat",
        accountId: req.body?.accountId || null
      });
      res.json({ ok: true, conversation: conv });
    } catch (err) {
      next(httpError(400, "AI_CONVERSATION_CREATE_FAILED", err.message));
    }
  });

  // 手动改名会话（不参与重名校验由调用方控制；这里只允许改自己的）
  router.patch("/conversations/:id", express.json(), (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const conv = store.getConversation(rootDir, projectId, req.params.id);
      if (!conv) return next(httpError(404, "AI_CONVERSATION_NOT_FOUND", "会话不存在"));
      const newTitle = String(req.body?.title || "").trim();
      if (!newTitle) return next(httpError(400, "AI_TITLE_EMPTY", "标题不能为空"));
      // 重名校验
      const dup = store.findDuplicateTitle(rootDir, projectId, newTitle, req.params.id);
      if (dup) {
        return next(httpError(409, "AI_TITLE_DUPLICATE", `已存在同名会话：${dup.title}`));
      }
      store.renameConversation(rootDir, projectId, req.params.id, newTitle);
      const updated = store.getConversation(rootDir, projectId, req.params.id);
      res.json({ ok: true, conversation: updated });
    } catch (err) {
      next(httpError(400, "AI_CONVERSATION_RENAME_FAILED", err.message));
    }
  });

  // 删除会话（级联删 messages / proposals）
  router.delete("/conversations/:id", (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const conv = store.getConversation(rootDir, projectId, req.params.id);
      if (!conv) return next(httpError(404, "AI_CONVERSATION_NOT_FOUND", "会话不存在"));
      const result = store.deleteConversation(rootDir, projectId, req.params.id);
      res.json({ ok: true, ...result });
    } catch (err) {
      next(httpError(500, "AI_CONVERSATION_DELETE_FAILED", err.message));
    }
  });

  router.get("/conversations", (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const user = getCurrentUser(req);
      const list = store.listConversations(rootDir, projectId, { userId: user.id });
      res.json({ ok: true, conversations: list });
    } catch (err) {
      next(httpError(500, "AI_CONVERSATION_LIST_FAILED", err.message));
    }
  });

  router.get("/conversations/:id", (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const conv = store.getConversation(rootDir, projectId, req.params.id);
      if (!conv) return next(httpError(404, "AI_CONVERSATION_NOT_FOUND", "会话不存在"));
      const messages = store.listMessages(rootDir, projectId, req.params.id);
      res.json({ ok: true, conversation: conv, messages });
    } catch (err) {
      next(httpError(500, "AI_CONVERSATION_READ_FAILED", err.message));
    }
  });

  // ===== 流式（Sprint 2 主用）=====
  router.post(
    "/conversations/:id/messages/stream",
    messageLimiter,
    express.json({ limit: "1mb" }),
    async (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const conv = store.getConversation(rootDir, projectId, req.params.id);
      if (!conv) return next(httpError(404, "AI_CONVERSATION_NOT_FOUND", "会话不存在"));

      const text = String(req.body?.text || "").trim();
      if (!text) return next(httpError(400, "EMPTY_MESSAGE", "消息内容为空"));

      sse.setupSse(res);
      await streamMessage(rootDir, req, res, projectId, conv, {
        text,
        model: req.body?.model || conv.model,
        provider: req.body?.provider || "deepseek",
        accountId: req.body?.accountId || conv.accountId,
        toolsEnabled: req.body?.toolsEnabled !== false
      });
    } catch (err) {
      // setupSse 已经写过 header 就不能再 next(err)
      if (!res.headersSent) {
        next(httpError(500, err.code || "AI_CHAT_FAILED", err.message));
      } else {
        sse.send(res, "error", { code: err.code || "AI_CHAT_FAILED", message: err.message });
        sse.endSse(res);
      }
    }
  });

  // ===== 同步（兼容 / 脚本 / 调试）=====
  router.post(
    "/conversations/:id/messages",
    messageLimiter,
    express.json({ limit: "1mb" }),
    async (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const conv = store.getConversation(rootDir, projectId, req.params.id);
      if (!conv) return next(httpError(404, "AI_CONVERSATION_NOT_FOUND", "会话不存在"));

      const text = String(req.body?.text || "").trim();
      if (!text) return next(httpError(400, "EMPTY_MESSAGE", "消息内容为空"));

      const providerKey = String(req.body?.provider || "deepseek");
      const { mod: provider } = pickProvider(providerKey);

      const accounts = readAccounts(rootDir);
      const account = selectAccount(accounts, {
        provider: providerKey,
        accountId: req.body?.accountId || conv.accountId
      });
      // 用户私有 key（per-user 隔离）
      const userKey = String(req.headers["x-ai-api-key"] || "").trim();
      if (userKey) {
        account.apiKey = userKey;
      }

      const userMsg = store.appendMessage(rootDir, projectId, {
        conversationId: conv.id,
        role: "user",
        content: text
      });

      // 自动命名（仅在 title 为空时）
      if (!conv.title) {
        const candidate = store.autoTitleFromText(text);
        if (candidate && store.setConversationTitleIfEmpty(rootDir, projectId, conv.id, candidate)) {
          conv.title = candidate;
        }
      }

      const systemPrompt = buildSystemPrompt({
        projectId,
        requirementId: conv.requirementId
      });
      const history = store.listMessages(rootDir, projectId, conv.id);
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content }))
      ];

      const result = await provider.chat(messages, {
        account,
        model: req.body?.model || conv.model
      });

      const aiMsg = store.appendMessage(rootDir, projectId, {
        conversationId: conv.id,
        role: "assistant",
        content: result.content,
        tokensIn: result.usage.inputTokens,
        tokensOut: result.usage.outputTokens
      });
      store.touchConversation(rootDir, projectId, conv.id);

      res.json({
        ok: true,
        userMessage: userMsg,
        assistantMessage: aiMsg,
        usage: result.usage,
        model: result.model
      });
    } catch (err) {
      const code = err.code || "AI_CHAT_FAILED";
      const status = err.status === 401 || err.status === 403 ? 400 : 500;
      next(httpError(status, code, err.message));
    }
  });

  // ===== Sprint 3：提案 =====
  router.get("/conversations/:id/proposals", (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const list = store.listProposals(rootDir, projectId, req.params.id);
      res.json({ ok: true, proposals: list });
    } catch (err) {
      next(httpError(500, "AI_PROPOSAL_LIST_FAILED", err.message));
    }
  });

  router.post("/proposals/:id/apply", express.json(), (req, res, next) => {
    try {
      const projectId = readProjectId(req);
      if (!isValidProjectId(projectId)) {
        return next(httpError(400, "INVALID_PROJECT", "缺少或非法的 projectId"));
      }
      const proposal = store.getProposal(rootDir, projectId, req.params.id);
      if (!proposal) {
        return next(httpError(404, "AI_PROPOSAL_NOT_FOUND", "提案不存在"));
      }
      if (proposal.status !== "pending") {
        return next(httpError(409, "AI_PROPOSAL_NOT_PENDING", `提案已是 ${proposal.status} 状态`));
      }
      if (!Array.isArray(proposal.events) || proposal.events.length === 0) {
        return next(httpError(400, "AI_PROPOSAL_EMPTY", "提案事件列表为空"));
      }

      // 走与 POST /projects/:project/events 同一段写入逻辑 + 重渲染
      const paths = projectPaths(rootDir, projectId);
      const user = getCurrentUser(req);
      // 强制 actor：AI 应用 + 当前用户
      const events = proposal.events.map((e) => ({
        ...e,
        actor: e.actor || `ai:${user.id}`
      }));

      const result = withLock(paths.lockPath, () => {
        appendEvents(paths.eventsPath, events);
        return render(paths);
      });

      store.markProposalApplied(rootDir, projectId, proposal.id, user.id);

      res.json({
        ok: true,
        applied: events.length,
        proposalId: proposal.id,
        items: result.items.length,
        updatedAt: result.updatedAt
      });
    } catch (err) {
      next(httpError(500, "AI_PROPOSAL_APPLY_FAILED", err.message));
    }
  });

  return router;
}

module.exports = { createAiRoutes };
