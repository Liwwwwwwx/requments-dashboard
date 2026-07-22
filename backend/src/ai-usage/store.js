"use strict";

/**
 * AI 账号存储。
 *
 * 只负责读取 chat 需要的账号配置（provider / baseUrl / modelId / apiKey），
 * 供 provider.selectAccount 选账号用。服务器可通过 DEEPSEEK_API_KEY
 * 为默认 DeepSeek 账号注入 key，前端不持有模型 key。
 *
 * 余额/额度同步、快照、chat 用量聚合等已移除。
 */

const { query } = require("../postgres");

const DEFAULT_ACCOUNTS = [
  {
    id: "deepseek-balance",
    provider: "deepseek",
    accountName: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelId: "",
    extraHeadersJson: "",
    enabled: true
  }
];

function nowIso() {
  return new Date().toISOString();
}

async function readAccounts() {
  const stored = await query("SELECT * FROM ai_accounts WHERE enabled = true ORDER BY id");
  const accounts = stored.rows.length ? stored.rows.map((row) => ({ id: row.id, provider: row.provider, accountName: row.account_name, baseUrl: row.base_url, modelId: row.model_id, extraHeadersJson: row.extra_headers_json ? JSON.stringify(row.extra_headers_json) : "", enabled: row.enabled })) : DEFAULT_ACCOUNTS;
  const deepseekKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
  if (!deepseekKey) return accounts;
  return accounts.map((account) => {
    if (account.provider !== "deepseek" || account.apiKey) return account;
    return { ...account, apiKey: deepseekKey };
  });
}

module.exports = {
  readAccounts
};
