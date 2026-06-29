"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { buildState, upsertAccount, appendSnapshot, parseExtraHeaders, modelsUrl } = require("./store");

function readStoredAccount(rootDir, accountId) {
  const accountsPath = path.join(rootDir, "data", "ai-usage", "accounts.json");
  if (!fs.existsSync(accountsPath)) return null;
  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8") || "[]");
  return accounts.find((account) => account.id === accountId) || null;
}

function withBaseUrl(baseUrl, pathname) {
  const normalized = String(baseUrl || "").trim().endsWith("/")
    ? String(baseUrl || "").trim()
    : `${String(baseUrl || "").trim()}/`;
  return new URL(pathname, normalized).toString();
}

function providerRootUrl(baseUrl) {
  const url = new URL(String(baseUrl || "").trim());
  url.pathname = url.pathname.replace(/\/v1\/?$/, "/");
  return url.toString();
}

function findNumberDeep(value, keys) {
  if (!value || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key)) {
      if (Number.isFinite(Number(item))) return Number(item);
      if (typeof item === "string") {
        const matched = item.match(/-?\d+(\.\d+)?/);
        if (matched && Number.isFinite(Number(matched[0]))) return Number(matched[0]);
      }
    }
  }
  for (const item of Object.values(value)) {
    if (item && typeof item === "object") {
      const found = findNumberDeep(item, keys);
      if (found !== null) return found;
    }
  }
  return null;
}

async function fetchProviderJson(url, account) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${account.apiKey}`,
        ...parseExtraHeaders(account.extraHeadersJson)
      },
      signal: controller.signal
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_err) {
      body = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      const detail = typeof body?.error === "object"
        ? body.error.message || JSON.stringify(body.error)
        : body?.error || body?.message || body?.raw || "";
      throw new Error(`同步请求失败: HTTP ${res.status}${detail ? ` - ${String(detail).slice(0, 200)}` : ""}`);
    }
    return body || {};
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFirstProviderJson(urls, account) {
  const errors = [];
  for (const url of urls) {
    try {
      return { body: await fetchProviderJson(url, account), url };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join("；"));
}

function minimaxUsageUrls(baseUrl) {
  const urls = [];
  const add = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };
  try {
    const url = new URL(String(baseUrl || "").trim());
    if (url.pathname.includes("/anthropic")) {
      url.pathname = "/v1/";
    }
    add(withBaseUrl(url.toString(), "token_plan/remains"));
    if (url.hostname.includes("minimaxi.com")) {
      add("https://www.minimaxi.com/v1/token_plan/remains");
      add("https://api.minimaxi.com/v1/token_plan/remains");
    } else if (url.hostname.includes("minimax.io")) {
      add("https://www.minimax.io/v1/token_plan/remains");
      add("https://api.minimax.io/v1/token_plan/remains");
    }
  } catch (_err) {
    add("https://www.minimaxi.com/v1/token_plan/remains");
    add("https://www.minimax.io/v1/token_plan/remains");
  }
  add("https://www.minimaxi.com/v1/token_plan/remains");
  add("https://www.minimax.io/v1/token_plan/remains");
  return urls;
}

function chooseMiniMaxRemain(account, body) {
  const remains = Array.isArray(body?.model_remains)
    ? body.model_remains
    : Array.isArray(body?.data?.model_remains)
      ? body.data.model_remains
      : [];
  if (remains.length === 0) return body?.data || body || {};

  const target = String(account.modelId || "").toLowerCase();
  const exact = target
    ? remains.find((item) => String(item.model || item.model_name || item.name || "").toLowerCase() === target)
    : null;
  const general = remains.find((item) => {
    const name = String(item.model || item.model_name || item.name || "").toLowerCase();
    return name === "general" || name.includes("m3") || name.includes("chat");
  });
  return exact || general || remains[0];
}

function normalizeMiniMaxSnapshot(account, body, syncUrl) {
  const remain = chooseMiniMaxRemain(account, body);
  const intervalTotal = findNumberDeep(remain, ["current_interval_total_count", "interval_total_count"]);
  const intervalRemaining = findNumberDeep(remain, ["current_interval_usage_count", "interval_usage_count"]);
  const weeklyTotal = findNumberDeep(remain, ["current_weekly_total_count", "weekly_total_count"]);
  const weeklyRemaining = findNumberDeep(remain, ["current_weekly_usage_count", "weekly_usage_count"]);
  const intervalPercent = findNumberDeep(remain, [
    "current_interval_remaining_percent",
    "interval_remaining_percent",
    "remaining_percent",
    "usage_percent",
    "usagePercent"
  ]);
  const weeklyPercent = findNumberDeep(remain, [
    "current_weekly_remaining_percent",
    "weekly_remaining_percent"
  ]);

  const hasIntervalCount = intervalTotal !== null && intervalTotal > 0 && intervalRemaining !== null;
  const hasWeeklyCount = weeklyTotal !== null && weeklyTotal > 0 && weeklyRemaining !== null;
  const quotaTotal = hasIntervalCount
    ? intervalTotal
    : hasWeeklyCount
      ? weeklyTotal
      : intervalPercent !== null
        ? 100
        : weeklyPercent !== null
          ? 100
          : null;
  const quotaRemaining = hasIntervalCount
    ? intervalRemaining
    : hasWeeklyCount
      ? weeklyRemaining
      : intervalPercent ?? weeklyPercent;
  const quotaUsed = quotaTotal !== null && quotaRemaining !== null
    ? Math.max(quotaTotal - quotaRemaining, 0)
    : null;
  const modelName = remain.model || remain.model_name || remain.name || account.modelId || "Token Plan";
  const weeklyText = hasWeeklyCount
    ? `；周剩余 ${weeklyRemaining}/${weeklyTotal}`
    : weeklyPercent !== null
      ? `；周剩余 ${weeklyPercent}%`
      : "";
  const intervalText = hasIntervalCount
    ? `5小时剩余 ${intervalRemaining}/${intervalTotal}`
    : intervalPercent !== null
      ? `5小时剩余 ${intervalPercent}%`
      : "5小时剩余未知";

  return {
    accountId: account.id,
    quotaTotal,
    quotaRemaining,
    quotaUsed,
    quotaUnit: "quota",
    metrics: {
      minimax: {
        modelName,
        interval: {
          total: intervalTotal,
          remaining: intervalRemaining,
          remainingPercent: hasIntervalCount
            ? Math.round((intervalRemaining / intervalTotal) * 100)
            : intervalPercent,
          startTime: remain.start_time || null,
          endTime: remain.end_time || null,
          remainsTime: remain.remains_time || null,
          status: remain.current_interval_status ?? null
        },
        weekly: {
          total: weeklyTotal,
          remaining: weeklyRemaining,
          remainingPercent: hasWeeklyCount
            ? Math.round((weeklyRemaining / weeklyTotal) * 100)
            : weeklyPercent,
          startTime: remain.weekly_start_time || null,
          endTime: remain.weekly_end_time || null,
          remainsTime: remain.weekly_remains_time || null,
          status: remain.current_weekly_status ?? null
        }
      }
    },
    sourceType: "api",
    status: "ok",
    note: `MiniMax Token Plan 同步：${modelName}；${intervalText}${weeklyText}；${syncUrl}`
  };
}

function normalizeKimiCodingSnapshot(account, body, syncUrl) {
  const usageLimit = findNumberDeep(body?.usage || {}, ["limit"]);
  const usageRemaining = findNumberDeep(body?.usage || {}, ["remaining"]);
  const usageUsed = findNumberDeep(body?.usage || {}, ["used"]);
  const totalLimit = findNumberDeep(body?.totalQuota || {}, ["limit"]);
  const totalRemaining = findNumberDeep(body?.totalQuota || {}, ["remaining"]);
  const fiveHour = Array.isArray(body?.limits)
    ? body.limits.find((item) => Number(item?.window?.duration) === 300)
      || body.limits[0]
    : null;
  const fiveHourLimit = findNumberDeep(fiveHour?.detail || {}, ["limit"]);
  const fiveHourRemaining = findNumberDeep(fiveHour?.detail || {}, ["remaining"]);
  const fiveHourUsed = findNumberDeep(fiveHour?.detail || {}, ["used"]);
  const fiveHourPercent = fiveHourLimit && fiveHourRemaining !== null
    ? Math.round((fiveHourRemaining / fiveHourLimit) * 100)
    : null;
  const usagePercent = usageLimit && usageRemaining !== null
    ? Math.round((usageRemaining / usageLimit) * 100)
    : null;
  const totalPercent = totalLimit && totalRemaining !== null
    ? Math.round((totalRemaining / totalLimit) * 100)
    : null;

  return {
    accountId: account.id,
    quotaTotal: fiveHourLimit ?? usageLimit ?? totalLimit,
    quotaRemaining: fiveHourRemaining ?? usageRemaining ?? totalRemaining,
    quotaUsed: fiveHourUsed ?? usageUsed ?? null,
    quotaUnit: "quota",
    metrics: {
      kimi: {
        level: body?.user?.membership?.level || null,
        subType: body?.subType || null,
        authenticationScope: body?.authentication?.scope || null,
        interval: {
          total: fiveHourLimit,
          remaining: fiveHourRemaining,
          used: fiveHourUsed,
          remainingPercent: fiveHourPercent,
          duration: fiveHour?.window?.duration ?? null,
          timeUnit: fiveHour?.window?.timeUnit || null,
          resetTime: fiveHour?.detail?.resetTime || null
        },
        period: {
          total: usageLimit,
          remaining: usageRemaining,
          used: usageUsed,
          remainingPercent: usagePercent,
          resetTime: body?.usage?.resetTime || null
        },
        totalQuota: {
          total: totalLimit,
          remaining: totalRemaining,
          remainingPercent: totalPercent
        }
      }
    },
    sourceType: "api",
    status: "ok",
    note: `Kimi Code Token Plan 同步：5小时 ${fiveHourPercent ?? "-"}%；周期 ${usagePercent ?? "-"}%；${syncUrl}`
  };
}

function normalizeSyncSnapshot(account, body, syncUrl = "") {
  if (account.provider === "deepseek") {
    const balance = findNumberDeep(body, ["total_balance", "balance", "available_balance"]);
    return {
      accountId: account.id,
      balanceAmount: balance,
      quotaUnit: account.quotaUnit || "CNY",
      sourceType: "api",
      status: "ok",
      note: "DeepSeek 余额同步"
    };
  }

  if (account.provider === "kimi") {
    if (body?.usage || body?.limits || body?.totalQuota) {
      return normalizeKimiCodingSnapshot(account, body, syncUrl);
    }
    const balance = findNumberDeep(body, ["available_balance", "balance", "cash_balance", "voucher_balance"]);
    return {
      accountId: account.id,
      balanceAmount: balance,
      quotaUnit: account.quotaUnit || "CNY",
      sourceType: "api",
      status: "ok",
      note: "Kimi 余额同步"
    };
  }

  if (account.provider === "minimax") return normalizeMiniMaxSnapshot(account, body, syncUrl);

  throw new Error("当前账号暂不支持自动同步，请用快照手动记录或导入 CSV");
}

async function syncAccount(rootDir, accountId) {
  const account = readStoredAccount(rootDir, accountId);
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  if (!account.baseUrl) throw new Error("Base URL 不能为空");
  if (!account.apiKey) throw new Error("API Key 不能为空");

  let url;
  if (account.provider === "deepseek") {
    url = withBaseUrl(providerRootUrl(account.baseUrl), "user/balance");
  } else if (account.provider === "kimi") {
    url = String(account.baseUrl || "").includes("/coding/")
      ? withBaseUrl(account.baseUrl, "usages")
      : withBaseUrl(account.baseUrl, "users/me/balance");
  } else if (account.provider === "minimax") {
    const result = await fetchFirstProviderJson(minimaxUsageUrls(account.baseUrl), account);
    const snapshot = appendSnapshot(rootDir, normalizeSyncSnapshot(account, result.body, result.url));
    return { snapshot, syncUrl: result.url };
  } else {
    throw new Error("当前账号暂不支持自动同步，请用快照手动记录或导入 CSV");
  }

  const body = await fetchProviderJson(url, account);
  const snapshot = appendSnapshot(rootDir, normalizeSyncSnapshot(account, body, url));
  return { snapshot, syncUrl: url };
}

async function testConnection(rootDir, input) {
  let storedAccount = null;
  if (input.id) {
    const accountsPath = path.join(rootDir, "data", "ai-usage", "accounts.json");
    if (fs.existsSync(accountsPath)) {
      const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8") || "[]");
      storedAccount = accounts.find((account) => account.id === input.id) || null;
    }
  }
  const baseUrl = String(input.baseUrl || "").trim();
  const apiKey = String(input.apiKey || storedAccount?.apiKey || "").trim();
  if (!baseUrl) throw new Error("Base URL 不能为空");
  if (!apiKey) throw new Error("API Key 不能为空");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(modelsUrl(baseUrl), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...parseExtraHeaders(input.extraHeadersJson)
      },
      signal: controller.signal
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_err) {
      body = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      const detail = typeof body?.error === "object"
        ? body.error.message || JSON.stringify(body.error)
        : body?.error || body?.message || body?.raw || "";
      throw new Error(`模型列表请求失败: HTTP ${res.status}${detail ? ` - ${String(detail).slice(0, 200)}` : ""}`);
    }
    const models = Array.isArray(body?.data)
      ? body.data.map((item) => item.id || item.name).filter(Boolean)
      : [];
    return {
      ok: true,
      status: res.status,
      models: models.slice(0, 100),
      modelCount: models.length
    };
  } finally {
    clearTimeout(timer);
  }
}

function createAiUsageRoutes(rootDir) {
  const router = express.Router();

  router.get("/state", (_req, res) => {
    try {
      return res.json(buildState(rootDir));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post("/accounts", express.json(), (req, res) => {
    try {
      const account = upsertAccount(rootDir, req.body || {});
      return res.json({ ok: true, account, state: buildState(rootDir) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/test", express.json(), async (req, res) => {
    try {
      const result = await testConnection(rootDir, req.body || {});
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/snapshots", express.json(), (req, res) => {
    try {
      const snapshot = appendSnapshot(rootDir, req.body || {});
      return res.json({ ok: true, snapshot, state: buildState(rootDir) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/accounts/:accountId/sync", express.json(), async (req, res) => {
    try {
      const result = await syncAccount(rootDir, req.params.accountId);
      return res.json({ ok: true, ...result, state: buildState(rootDir) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createAiUsageRoutes };
