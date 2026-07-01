"use strict";

/**
 * 通用 LLM Provider 接口。
 *
 * 调用方只依赖这两个方法，不直接接触 OpenAI / DeepSeek 协议差异。
 *   - chat(messages, options) -> { content, usage }
 *   - chatStream(messages, options, onChunk) -> { content, usage }
 */

class ProviderError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status || null;
  }
}

function ensureAccount(account) {
  if (!account) throw new ProviderError("NO_ACCOUNT", "未提供账号");
  if (!account.apiKey) {
    throw new ProviderError("NO_API_KEY", `账号 ${account.id} 未配置 API Key`);
  }
  if (!account.baseUrl) {
    throw new ProviderError("NO_BASE_URL", `账号 ${account.id} 未配置 Base URL`);
  }
}

function joinUrl(baseUrl, pathname) {
  const trimmed = String(baseUrl || "").trim();
  const normalized = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return new URL(pathname, normalized).toString();
}

function parseExtraHeaders(json) {
  const text = String(json || "").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
  } catch (_err) {
    return {};
  }
}

module.exports = { ProviderError, ensureAccount, joinUrl, parseExtraHeaders };
