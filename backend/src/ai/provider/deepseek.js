"use strict";

/**
 * DeepSeek Provider。
 *
 * DeepSeek API 与 OpenAI Chat Completions 协议兼容：POST {baseUrl}/chat/completions，
 * 走 Bearer 鉴权，请求 / 响应字段与 OpenAI 一致。流式返回 SSE，data: {json}\n\n。
 *
 * 故意不引入 openai SDK：项目后端只用 Node 18+ 自带 fetch，保持依赖最小。
 */

const { ProviderError, ensureAccount, joinUrl, parseExtraHeaders } = require("./base");

const DEFAULT_MODEL = "deepseek-chat";

function resolveModel(account, override) {
  const fromOverride = String(override || "").trim();
  if (fromOverride) return fromOverride;
  const fromAccount = String(account?.modelId || "").trim();
  if (fromAccount) return fromAccount;
  return DEFAULT_MODEL;
}

function buildHeaders(account) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${account.apiKey}`,
    Accept: "application/json",
    ...parseExtraHeaders(account.extraHeadersJson)
  };
}

async function callChatCompletions(account, payload, { signal } = {}) {
  const url = joinUrl(account.baseUrl, "chat/completions");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  // 把外层 signal 串起来。signal.aborted 时透传（说明上层明确想取消），不要无条件 abort。
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(account),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (_err) {
        body = { raw: text.slice(0, 500) };
      }
    }
    if (!res.ok) {
      const detail = typeof body?.error === "object" ? body.error?.message : body?.error?.message || body?.raw || `HTTP ${res.status}`;
      throw new ProviderError("DEEPSEEK_HTTP_ERROR", `DeepSeek 调用失败：${detail}`, res.status);
    }
    return body;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err.name === "AbortError") {
      throw new ProviderError("DEEPSEEK_TIMEOUT", "DeepSeek 请求超时或被中断");
    }
    throw new ProviderError("DEEPSEEK_NETWORK_ERROR", `DeepSeek 网络错误：${err.message}`);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", controller.abort);
  }
}

function extractContent(body) {
  if (!body) return "";
  const choice = Array.isArray(body.choices) ? body.choices[0] : null;
  if (!choice) return "";
  return String(choice.message?.content || "").trim();
}

function extractToolCalls(body) {
  if (!body) return [];
  const choice = Array.isArray(body.choices) ? body.choices[0] : null;
  if (!choice) return [];
  const calls = choice.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.map((call) => ({
    id: call.id || null,
    name: call.function?.name || "",
    arguments: call.function?.arguments || ""
  }));
}

function extractUsage(body) {
  const u = body?.usage || {};
  return {
    inputTokens: Number(u.prompt_tokens) || 0,
    outputTokens: Number(u.completion_tokens) || 0,
    totalTokens: Number(u.total_tokens) || 0
  };
}

async function chat(messages, { account, model, temperature, tools, toolChoice, signal } = {}) {
  ensureAccount(account);
  const payload = {
    model: resolveModel(account, model),
    messages,
    stream: false,
    temperature: typeof temperature === "number" ? temperature : 0.4
  };
  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
    if (toolChoice) payload.tool_choice = toolChoice;
  }
  const body = await callChatCompletions(account, payload, { signal });
  return {
    content: extractContent(body),
    toolCalls: extractToolCalls(body),
    usage: extractUsage(body),
    model: body?.model || payload.model,
    raw: body
  };
}

async function chatStream(messages, { account, model, temperature, signal, tools, toolChoice, onChunk } = {}) {
  ensureAccount(account);
  const payload = {
    model: resolveModel(account, model),
    messages,
    stream: true,
    temperature: typeof temperature === "number" ? temperature : 0.4
  };
  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
    if (toolChoice) payload.tool_choice = toolChoice;
  }
  const url = joinUrl(account.baseUrl, "chat/completions");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  // 不要再做 if (signal.aborted) controller.abort() —— 这个判断会让请求立即 abort，
  // 因为 Node HTTP server 在响应写完后也会让上层的 signal 进入 aborted 状态，
  // 但此时客户端并没有真的断开。让上层（streamMessage）通过 clientClosedEarly 区分。
  if (signal && !signal.aborted) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  } else if (signal && signal.aborted) {
    // 上层信号已 abort（说明上层明确想取消），透传
    controller.abort();
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let resolvedModel = payload.model;
  let fullText = "";
  // 累积流式 tool_calls（按 index 累加 arguments 字符串）
  const toolCallAccum = new Map();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(account),
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text;
      try {
        detail = JSON.parse(text)?.error?.message || detail;
      } catch (_err) {
        // ignore
      }
      throw new ProviderError("DEEPSEEK_HTTP_ERROR", `DeepSeek 调用失败：${detail}`, res.status);
    }
    if (!res.body) {
      throw new ProviderError("DEEPSEEK_NO_STREAM", "DeepSeek 未返回可读流");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let aborted = false;

    while (!aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          aborted = true;
          break;
        }
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_err) {
          continue;
        }
        if (json.model) resolvedModel = json.model;
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          if (typeof onChunk === "function") onChunk(delta);
        }
        // 累积流式 tool_calls
        const toolDeltas = json.choices?.[0]?.delta?.tool_calls;
        if (Array.isArray(toolDeltas)) {
          for (const t of toolDeltas) {
            const idx = typeof t.index === "number" ? t.index : 0;
            const prev = toolCallAccum.get(idx) || {
              id: null,
              name: "",
              arguments: ""
            };
            if (t.id) prev.id = t.id;
            if (t.function?.name) prev.name += t.function.name;
            if (typeof t.function?.arguments === "string") {
              prev.arguments += t.function.arguments;
            }
            toolCallAccum.set(idx, prev);
          }
        }
        if (json.usage) {
          inputTokens = Number(json.usage.prompt_tokens) || inputTokens;
          outputTokens = Number(json.usage.completion_tokens) || outputTokens;
          totalTokens = Number(json.usage.total_tokens) || totalTokens;
        }
      }
    }

    return {
      content: fullText.trim(),
      toolCalls: Array.from(toolCallAccum.values()).map((t) => ({
        id: t.id,
        name: t.name,
        arguments: t.arguments
      })),
      usage: { inputTokens, outputTokens, totalTokens },
      model: resolvedModel
    };
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err.name === "AbortError") {
      // 上游主动取消，原样抛，让 streamMessage 区分客户端取消 vs provider 错误
      throw err;
    }
    throw new ProviderError("DEEPSEEK_NETWORK_ERROR", `DeepSeek 网络错误：${err.message}`);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", controller.abort);
  }
}

module.exports = { chat, chatStream, DEFAULT_MODEL };
