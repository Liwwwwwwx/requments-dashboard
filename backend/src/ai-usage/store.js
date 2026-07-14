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

const fs = require("fs");
const path = require("path");

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

function usagePaths(rootDir) {
  const dataDir = path.join(rootDir, "data", "ai-usage");
  return {
    dataDir,
    accountsPath: path.join(dataDir, "accounts.json")
  };
}

function ensureStore(rootDir) {
  const paths = usagePaths(rootDir);
  fs.mkdirSync(paths.dataDir, { recursive: true });
  if (!fs.existsSync(paths.accountsPath)) {
    const accounts = DEFAULT_ACCOUNTS.map((account) => ({
      ...account,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }));
    fs.writeFileSync(paths.accountsPath, `${JSON.stringify(accounts, null, 2)}\n`, "utf8");
  }
  return paths;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return fallback;
  return JSON.parse(content);
}

function readAccounts(rootDir) {
  const paths = ensureStore(rootDir);
  const accounts = readJson(paths.accountsPath, []);
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
