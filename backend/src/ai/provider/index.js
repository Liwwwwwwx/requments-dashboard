"use strict";

/**
 * Provider 注册中心。
 *
 * 当前只接 DeepSeek。后续要加 OpenAI / Kimi / 自托管，在 switch 里加 case 即可。
 * 选账号的规则：
 *   1. 调用方显式传 accountId -> 精确匹配
 *   2. 否则挑 provider 匹配 + enabled 的第一个（requireApiKey=true 时要求服务器侧账号有 apiKey）
 */

const deepseek = require("./deepseek");

const PROVIDERS = {
  deepseek
};

function listProviders() {
  return Object.keys(PROVIDERS);
}

function pickProvider(provider) {
  const key = String(provider || "deepseek").toLowerCase();
  const mod = PROVIDERS[key];
  if (!mod) throw new Error(`暂不支持的 provider：${provider}`);
  return { key, mod };
}

function selectAccount(accounts, { provider = "deepseek", accountId, requireApiKey = true } = {}) {
  const targetProvider = String(provider).toLowerCase();
  const usable = accounts.filter(
    (a) => a.provider === targetProvider && a.enabled !== false && (!requireApiKey || a.apiKey)
  );
  if (accountId) {
    const found = usable.find((a) => a.id === accountId);
    if (!found) {
      throw new Error(`未找到可用账号：provider=${targetProvider} id=${accountId}`);
    }
    return found;
  }
  if (usable.length === 0) {
    throw new Error(`没有可用的 ${targetProvider} 账号（请在服务器配置账号 API Key）`);
  }
  // 优先取 baseUrl=官方默认的
  const official = usable.find((a) =>
    a.baseUrl?.includes(targetProvider === "deepseek" ? "deepseek.com" : targetProvider)
  );
  return official || usable[0];
}

module.exports = { listProviders, pickProvider, selectAccount };
