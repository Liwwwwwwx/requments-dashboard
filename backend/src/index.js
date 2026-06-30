"use strict";

const express = require("express");
const cors = require("cors");
const { createRoutes } = require("./routes");
const { errorMiddleware } = require("./errors");
const { syncAllAccounts } = require("./ai-usage/sync");

const ROOT = process.env.REQUIREMENTS_ROOT || require("path").resolve(__dirname, "..", "..");
const HOST = process.env.REQUIREMENTS_HOST || "127.0.0.1";
const PORT = Number(process.env.REQUIREMENTS_PORT || 4315);

const SYNC_DISABLED = /^(1|true|yes)$/i.test(process.env.AI_USAGE_SYNC_DISABLED || "");
const SYNC_ON_BOOT = /^(1|true|yes)$/i.test(process.env.AI_USAGE_SYNC_ON_BOOT || "");

const SYNC_CRON = (process.env.AI_USAGE_SYNC_CRON || "08:00").trim();
const SYNC_INTERVAL_MS = Number(process.env.AI_USAGE_SYNC_INTERVAL_MS || 0);
const SYNC_TIMEZONE = process.env.AI_USAGE_SYNC_TZ || "Asia/Shanghai";

function parseCronHHMM(value) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function getLocalYmd(now, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")) };
}

function getLocalHms(now, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(now);
  return {
    h: Number(parts.find((p) => p.type === "hour").value) % 24,
    m: Number(parts.find((p) => p.type === "minute").value),
    s: Number(parts.find((p) => p.type === "second").value)
  };
}

function localMidnightUtc(now, timeZone) {
  const { y, m, d } = getLocalYmd(now, timeZone);
  let lo = now.getTime() - 36 * 3600 * 1000;
  let hi = now.getTime() + 36 * 3600 * 1000;
  let found = null;
  for (let i = 0; i < 60; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const ymd = getLocalYmd(new Date(mid), timeZone);
    const cmp = (ymd.y - y) || (ymd.m - m) || (ymd.d - d);
    if (cmp < 0) lo = mid;
    else if (cmp > 0) hi = mid;
    else { found = mid; break; }
  }
  if (found === null) return null;
  const { h, m: mm, s } = getLocalHms(new Date(found), timeZone);
  return found - (h * 3600 + mm * 60 + s) * 1000;
}

function nextRunAt(target, now, timeZone) {
  const midnight = localMidnightUtc(now, timeZone);
  if (midnight === null) return null;
  let next = midnight + target.hour * 3600 * 1000 + target.minute * 60 * 1000;
  if (next <= now.getTime()) next += 24 * 3600 * 1000;
  return next;
}

function formatLocalClock(epochMs, timeZone) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(epochMs));
}

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", createRoutes(ROOT));
app.use(errorMiddleware());

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Requirements board backend listening at http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  data dir: ${require("path").join(ROOT, "data")}`);
});

if (SYNC_DISABLED) {
  // eslint-disable-next-line no-console
  console.log("[ai-usage] 自动同步已禁用（AI_USAGE_SYNC_DISABLED）");
} else {
  const runOnce = async (trigger) => {
    try {
      const results = await syncAllAccounts(ROOT);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      // eslint-disable-next-line no-console
      console.log(`[ai-usage] ${trigger}：成功 ${ok}，失败 ${failed}`);
      results.filter((r) => !r.ok).forEach((r) => {
        // eslint-disable-next-line no-console
        console.warn(`[ai-usage]   ${r.accountId}: ${r.error}`);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[ai-usage] ${trigger} 失败: ${err.message}`);
    }
  };

  let timer = null;
  let interval = null;
  let description = "";

  if (Number.isFinite(SYNC_INTERVAL_MS) && SYNC_INTERVAL_MS > 0) {
    description = `每 ${SYNC_INTERVAL_MS}ms 同步一次`;
    interval = setInterval(() => runOnce("定时同步"), SYNC_INTERVAL_MS);
  } else {
    const target = parseCronHHMM(SYNC_CRON);
    if (!target) {
      // eslint-disable-next-line no-console
      console.log(`[ai-usage] 自动同步 cron 非法（${SYNC_CRON}），已禁用`);
    } else {
      const scheduleNext = () => {
        const delay = nextRunAt(target, new Date(), SYNC_TIMEZONE);
        if (delay === null) {
          // eslint-disable-next-line no-console
          console.log("[ai-usage] 自动同步调度失败，时区无效");
          return;
        }
        const wait = Math.max(delay - Date.now(), 1000);
        const at = formatLocalClock(delay, SYNC_TIMEZONE);
        // eslint-disable-next-line no-console
        console.log(`[ai-usage] 下一次自动同步：${at}（${SYNC_TIMEZONE} ${SYNC_CRON}）`);
        timer = setTimeout(async () => {
          await runOnce("每日定时同步");
          scheduleNext();
        }, wait);
      };
      description = `每天 ${SYNC_CRON}（${SYNC_TIMEZONE}）同步一次`;
      scheduleNext();
    }
  }

  if (description) {
    // eslint-disable-next-line no-console
    console.log(`[ai-usage] 自动同步已启用，${description}${SYNC_ON_BOOT ? "，启动后立即跑一次" : ""}`);
  }

  if (SYNC_ON_BOOT) runOnce("启动同步");

  const shutdown = () => {
    if (timer) clearTimeout(timer);
    if (interval) clearInterval(interval);
  };
  process.on("SIGINT", () => { shutdown(); process.exit(0); });
  process.on("SIGTERM", () => { shutdown(); process.exit(0); });
}