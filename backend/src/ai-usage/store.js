"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_ACCOUNTS = [
  {
    id: "kimi-token-plan",
    provider: "kimi",
    accountName: "Kimi Token Plan",
    accountType: "token_plan",
    dataSource: "manual",
    baseUrl: "https://api.moonshot.ai/v1",
    modelId: "",
    extraHeadersJson: "",
    quotaUnit: "token",
    warningThreshold: 20,
    enabled: true,
    notes: "先记录 Token Plan 剩余额度；项目内调用后续接入 usage event。"
  },
  {
    id: "minimax-token-plan",
    provider: "minimax",
    accountName: "MiniMax Token Plan",
    accountType: "token_plan",
    dataSource: "api",
    baseUrl: "https://api.minimaxi.com/v1",
    modelId: "",
    extraHeadersJson: "",
    quotaUnit: "token",
    warningThreshold: 15,
    enabled: true,
    notes: "后续接入 token_plan/remains 或 mmx quota。"
  },
  {
    id: "deepseek-balance",
    provider: "deepseek",
    accountName: "DeepSeek 余额",
    accountType: "balance",
    dataSource: "api",
    baseUrl: "https://api.deepseek.com/v1",
    modelId: "",
    extraHeadersJson: "",
    quotaUnit: "CNY",
    warningThreshold: 50,
    enabled: true,
    notes: "后续接入 /user/balance；调用明细由项目网关累计。"
  }
];

const DEFAULT_BASE_URL = {
  kimi: "https://api.moonshot.ai/v1",
  minimax: "https://api.minimaxi.com/v1",
  deepseek: "https://api.deepseek.com/v1"
};

const SUPPORTED_PROVIDERS = new Set(["kimi", "minimax", "deepseek"]);

function inferProvider(input) {
  const text = `${input.provider || ""} ${input.baseUrl || ""} ${input.accountName || ""}`.toLowerCase();
  if (text.includes("minimax") || text.includes("minimaxi")) return "minimax";
  if (text.includes("moonshot") || text.includes("kimi")) return "kimi";
  if (text.includes("deepseek")) return "deepseek";
  return String(input.provider || "custom").trim() || "custom";
}

function defaultAccountType(provider) {
  if (provider === "deepseek") return "balance";
  if (provider === "kimi" || provider === "minimax") return "token_plan";
  return "api";
}

function defaultQuotaUnit(provider) {
  if (provider === "deepseek") return "CNY";
  return "token";
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function usagePaths(rootDir) {
  const dataDir = path.join(rootDir, "data", "ai-usage");
  return {
    dataDir,
    accountsPath: path.join(dataDir, "accounts.json"),
    snapshotsPath: path.join(dataDir, "snapshots.jsonl")
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
  if (!fs.existsSync(paths.snapshotsPath)) {
    fs.writeFileSync(paths.snapshotsPath, "", "utf8");
  }
  return paths;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return fallback;
  return JSON.parse(content);
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.trim()) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid AI usage snapshot at line ${index + 1}: ${error.message}`);
      }
    });
}

function writeAccounts(paths, accounts) {
  fs.writeFileSync(paths.accountsPath, `${JSON.stringify(accounts, null, 2)}\n`, "utf8");
}

function readAccounts(rootDir) {
  const paths = ensureStore(rootDir);
  return readJson(paths.accountsPath, []);
}

function readSnapshots(rootDir) {
  const paths = ensureStore(rootDir);
  return readJsonl(paths.snapshotsPath);
}

function latestByAccount(snapshots) {
  const map = new Map();
  for (const snapshot of snapshots) {
    const prev = map.get(snapshot.accountId);
    if (!prev || String(snapshot.collectedAt).localeCompare(String(prev.collectedAt)) > 0) {
      map.set(snapshot.accountId, snapshot);
    }
  }
  return map;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

function sanitizeAccount(account) {
  const { apiKey, ...rest } = account;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    apiKeyMasked: maskSecret(apiKey)
  };
}

function parseExtraHeaders(extraHeadersJson) {
  const text = String(extraHeadersJson || "").trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("额外 Headers 必须是 JSON 对象");
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, String(value)])
  );
}

function modelsUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) throw new Error("Base URL 不能为空");
  const normalized = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return new URL("models", normalized).toString();
}

function deriveUsage(snapshot) {
  const quotaTotal = toNumber(snapshot.quotaTotal);
  const quotaRemaining = toNumber(snapshot.quotaRemaining);
  const quotaUsed = toNumber(snapshot.quotaUsed);

  if (quotaTotal !== null && quotaRemaining !== null) {
    return {
      quotaTotal,
      quotaRemaining,
      quotaUsed: quotaUsed !== null ? quotaUsed : Math.max(quotaTotal - quotaRemaining, 0),
      usagePercent: quotaTotal > 0 ? Math.round(((quotaTotal - quotaRemaining) / quotaTotal) * 100) : null,
      remainingPercent: quotaTotal > 0 ? Math.round((quotaRemaining / quotaTotal) * 100) : null
    };
  }

  return {
    quotaTotal,
    quotaRemaining,
    quotaUsed,
    usagePercent: null,
    remainingPercent: null
  };
}

function buildState(rootDir) {
  const accounts = readAccounts(rootDir).filter((account) => SUPPORTED_PROVIDERS.has(account.provider));
  const snapshots = readSnapshots(rootDir);
  const latestMap = latestByAccount(snapshots);

  const items = accounts.map((account) => {
    const latestSnapshot = latestMap.get(account.id) || null;
    const usage = latestSnapshot ? deriveUsage(latestSnapshot) : {
      quotaTotal: null,
      quotaRemaining: null,
      quotaUsed: null,
      usagePercent: null,
      remainingPercent: null
    };
    const threshold = Number(account.warningThreshold || 0);
    const lowQuota = usage.remainingPercent !== null && usage.remainingPercent <= threshold;
    const balance = latestSnapshot ? toNumber(latestSnapshot.balanceAmount) : null;
    const lowBalance = account.accountType === "balance" && balance !== null && threshold > 0 && balance <= threshold;
    const stale = latestSnapshot
      ? Date.now() - new Date(latestSnapshot.collectedAt).getTime() > 24 * 60 * 60 * 1000
      : true;

    return {
      ...sanitizeAccount(account),
      latestSnapshot,
      usage,
      risk: lowQuota || lowBalance ? "warning" : stale ? "stale" : "ok"
    };
  });

  const totalAccounts = items.length;
  const warningAccounts = items.filter((item) => item.risk === "warning").length;
  const staleAccounts = items.filter((item) => item.risk === "stale").length;
  const lastCollectedAt = items
    .map((item) => item.latestSnapshot?.collectedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    ok: true,
    updatedAt: localDate(),
    summary: {
      totalAccounts,
      warningAccounts,
      staleAccounts,
      snapshotCount: snapshots.length,
      lastCollectedAt
    },
    accounts: items,
    recentSnapshots: snapshots
      .slice()
      .sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)))
      .slice(0, 50)
  };
}

function upsertAccount(rootDir, input) {
  const paths = ensureStore(rootDir);
  const accounts = readJson(paths.accountsPath, []);
  const provider = inferProvider(input);
  const id = String(input.id || `${provider}-${Date.now()}`)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();
  if (!id) throw new Error("INVALID_ACCOUNT_ID");

  const next = {
    id,
    provider,
    accountName: String(input.accountName || "").trim(),
    accountType: String(input.accountType || defaultAccountType(provider)).trim(),
    dataSource: String(input.dataSource || "api").trim(),
    baseUrl: String(input.baseUrl || DEFAULT_BASE_URL[provider] || "").trim(),
    modelId: String(input.modelId || "").trim(),
    extraHeadersJson: String(input.extraHeadersJson || "").trim(),
    quotaUnit: String(input.quotaUnit || defaultQuotaUnit(provider)).trim(),
    warningThreshold: toNumber(input.warningThreshold) ?? 20,
    planRenewAt: input.planRenewAt || "",
    enabled: input.enabled !== false,
    notes: String(input.notes || "").trim(),
    updatedAt: nowIso()
  };

  if (!next.accountName) {
    throw new Error("名称不能为空");
  }
  if (!SUPPORTED_PROVIDERS.has(next.provider)) {
    throw new Error("当前仅支持 Kimi、MiniMax、DeepSeek");
  }
  if (next.extraHeadersJson) {
    parseExtraHeaders(next.extraHeadersJson);
  }

  const index = accounts.findIndex((account) => account.id === id);
  if (index >= 0) {
    accounts[index] = {
      ...accounts[index],
      ...next,
      apiKey: String(input.apiKey || "").trim() || accounts[index].apiKey || ""
    };
  } else {
    accounts.push({
      ...next,
      apiKey: String(input.apiKey || "").trim(),
      createdAt: nowIso()
    });
  }
  writeAccounts(paths, accounts);
  const saved = accounts.find((account) => account.id === id);
  return sanitizeAccount(saved);
}

function appendSnapshot(rootDir, input) {
  const paths = ensureStore(rootDir);
  const accounts = readJson(paths.accountsPath, []);
  const accountId = String(input.accountId || "").trim();
  const account = accounts.find((item) => item.id === accountId);
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");

  const snapshot = {
    id: createId("snapshot"),
    accountId,
    provider: account.provider,
    collectedAt: input.collectedAt || nowIso(),
    periodStart: input.periodStart || "",
    periodEnd: input.periodEnd || "",
    balanceAmount: toNumber(input.balanceAmount),
    quotaTotal: toNumber(input.quotaTotal),
    quotaRemaining: toNumber(input.quotaRemaining),
    quotaUsed: toNumber(input.quotaUsed),
    quotaUnit: String(input.quotaUnit || account.quotaUnit || "token"),
    inputTokens: toNumber(input.inputTokens),
    outputTokens: toNumber(input.outputTokens),
    totalTokens: toNumber(input.totalTokens),
    requestCount: toNumber(input.requestCount),
    costAmount: toNumber(input.costAmount),
    metrics: input.metrics && typeof input.metrics === "object" ? input.metrics : null,
    sourceType: String(input.sourceType || "manual"),
    status: String(input.status || "ok"),
    note: String(input.note || "").trim()
  };
  fs.appendFileSync(paths.snapshotsPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  return snapshot;
}

module.exports = {
  buildState,
  upsertAccount,
  appendSnapshot,
  parseExtraHeaders,
  modelsUrl,
  sanitizeAccount
};
