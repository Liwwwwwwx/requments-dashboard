"use strict";

/**
 * 流式对话处理：把 DeepSeek 流式 chunk 转成 SSE 事件发到客户端。
 *
 * SSE 事件协议（前端按 event 字段分发）：
 *   - "user"      : { message }
 *   - "start"     : { messageId, conversationId, model }
 *   - "delta"     : { delta }
 *   - "usage"     : { inputTokens, outputTokens, totalTokens }
 *   - "proposal"  : { proposalId, rationale, events, errors? }
 *   - "done"      : { message, usage, proposalId? }
 *   - "error"     : { code, message }
 *
 * 客户端断线 / `req.on('close')` 会通过 AbortController 中止 DeepSeek 调用，避免浪费 token。
 */

const { readAccounts } = require("../ai-usage/store");
const { pickProvider, selectAccount } = require("./provider");
const store = require("./store");
const { buildSystemPrompt } = require("./context");
const { PROPOSE_EVENTS_TOOL, validateProposedEvents } = require("./tools/propose-events");
const sse = require("./sse");

function isValidProjectId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

function sendErrorAndEnd(res, code, message, status) {
  if (res.writableEnded) return;
  if (status) res.statusCode = status;
  sse.send(res, "error", { code, message });
  sse.endSse(res);
}

async function streamMessage(rootDir, req, res, projectId, conv, body) {
  const providerKey = String(body?.provider || "deepseek");
  const { mod: provider, key: resolvedProviderKey } = pickProvider(providerKey);

  const accounts = readAccounts(rootDir);
  const account = selectAccount(accounts, {
    provider: providerKey,
    accountId: body?.accountId || conv.accountId
  });

  // 1. 落库 user 消息
  const userMsg = store.appendMessage(rootDir, projectId, {
    conversationId: conv.id,
    role: "user",
    content: body.text
  });
  sse.send(res, "user", { message: userMsg });

  // 1b. 自动命名（仅在 title 为空时），前端订阅 `titled` 事件后能立刻刷新左侧栏
  let titledNow = false;
  if (!conv.title) {
    const candidate = store.autoTitleFromText(body.text);
    if (candidate) {
      titledNow = store.setConversationTitleIfEmpty(rootDir, projectId, conv.id, candidate);
      if (titledNow) {
        conv.title = candidate;
      }
    }
  }
  sse.send(res, "titled", { conversationId: conv.id, title: conv.title || null });

  // 2. 构造 messages
  const systemPrompt = buildSystemPrompt(rootDir, {
    projectId,
    requirementId: conv.requirementId
  });
  const history = store.listMessages(rootDir, projectId, conv.id);
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }))
  ];

  // 3. 准备流式 assistant 消息（先占位，落库前不持久化内容）
  const assistantMsg = store.appendMessage(rootDir, projectId, {
    conversationId: conv.id,
    role: "assistant",
    content: "",
    tokensIn: 0,
    tokensOut: 0
  });
  sse.send(res, "start", {
    messageId: assistantMsg.id,
    conversationId: conv.id,
    model: body.model || conv.model
  });

  // 4. 客户端断线 -> abort provider。
// 用 res.on('close') 而不是 req.on('close')，因为 req.on('close') 在 HTTP/1.1
// keep-alive 完成响应后也会触发，而 res.on('close') 只在客户端真的断开 / abort 时触发。
  const abortController = new AbortController();
  let clientClosedEarly = false;
  const onClose = () => {
    clientClosedEarly = true;
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  res.on("close", onClose);

  let buffer = "";
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let resolvedModel = body.model || conv.model;
  const stopHeartbeat = sse.heartbeat(res);

  try {
    const result = await provider.chatStream(messages, {
      account,
      model: body.model || conv.model,
      signal: abortController.signal,
      tools: body.toolsEnabled === false ? undefined : [PROPOSE_EVENTS_TOOL],
      onChunk: (delta) => {
        if (!delta) return;
        buffer += delta;
        sse.send(res, "delta", { delta });
      }
    });
    buffer = result.content || buffer;
    usage = result.usage || usage;
    resolvedModel = result.model || resolvedModel;
    const toolCalls = result.toolCalls || [];

    // 4b. 处理 propose_events 工具调用
    let proposalSummary = null;
    const proposeCall = toolCalls.find((c) => c.name === "propose_events");
    if (proposeCall) {
      let parsedArgs = null;
      try {
        parsedArgs = JSON.parse(proposeCall.arguments || "{}");
      } catch (err) {
        sse.send(res, "error", {
          code: "AI_PROPOSAL_PARSE_FAILED",
          message: `模型返回的建议变更参数无法解析：${err.message}`
        });
      }
      if (parsedArgs) {
        const events = Array.isArray(parsedArgs.events) ? parsedArgs.events : [];
        const validation = validateProposedEvents(events);
        if (!validation.valid) {
          sse.send(res, "error", {
            code: "AI_PROPOSAL_INVALID",
            message: "模型返回的建议事件不符合 V2 写入范围",
            errors: validation.errors
          });
        } else {
          const proposal = store.createProposal(rootDir, projectId, {
            conversationId: conv.id,
            messageId: assistantMsg.id,
            events: validation.events
          });
          proposalSummary = {
            proposalId: proposal.id,
            rationale: parsedArgs.rationale || "",
            events: validation.events,
            errors: null
          };
          sse.send(res, "proposal", proposalSummary);
        }
      }
    }

    // 5. 把占位消息覆写为完整内容 + tool_calls 元数据
    const finalMsg = store.updateMessageContent(rootDir, projectId, assistantMsg.id, {
      content: buffer,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens
    });
    store.touchConversation(rootDir, projectId, conv.id);

    // 把 tool_calls 也存到消息里（用于对话历史展示）
    if (toolCalls.length > 0) {
      const db = store.openAiDb(rootDir, projectId);
      try {
        db.prepare("UPDATE ai_messages SET tool_calls = ? WHERE id = ?").run(
          JSON.stringify(toolCalls),
          finalMsg.id
        );
      } finally {
        db.close();
      }
    }

    sse.send(res, "usage", usage);
    const donePayload = {
      message: finalMsg,
      usage,
      model: resolvedModel
    };
    if (proposalSummary?.proposalId) {
      donePayload.proposalId = proposalSummary.proposalId;
    }
    sse.send(res, "done", donePayload);
    sse.endSse(res);
  } catch (err) {
    const code = err.code || "AI_CHAT_FAILED";
    // 把已 buffer 的内容也保留，便于用户复盘
    if (buffer) {
      store.updateMessageContent(rootDir, projectId, assistantMsg.id, {
        content: buffer,
        tokensIn: usage.inputTokens,
        tokensOut: usage.outputTokens
      });
    }
    // 如果客户端已主动断开，则用 aborted 事件代替 error；否则把错误推回客户端
    if (err.name === "AbortError") {
      if (buffer) {
        store.updateMessageContent(rootDir, projectId, assistantMsg.id, {
          content: buffer + "\n[已中断]",
          tokensIn: usage.inputTokens,
          tokensOut: usage.outputTokens
        });
        store.touchConversation(rootDir, projectId, conv.id);
      }
      sse.send(res, "aborted", { reason: err.message || "aborted" });
      sse.endSse(res);
      return;
    }
    sendErrorAndEnd(res, code, err.message || "AI 调用失败");
  } finally {
    stopHeartbeat();
    res.off("close", onClose);
  }
}

module.exports = { streamMessage, isValidProjectId };
