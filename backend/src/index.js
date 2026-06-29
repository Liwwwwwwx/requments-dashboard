"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createRoutes } = require("./routes");
const { syncAllAccounts } = require("./ai-usage/sync");

const ROOT = process.env.REQUIREMENTS_ROOT || path.resolve(__dirname, "..", "..");
const HOST = process.env.REQUIREMENTS_HOST || "127.0.0.1";
const PORT = Number(process.env.REQUIREMENTS_PORT || 4315);

const SYNC_DISABLED = /^(1|true|yes)$/i.test(process.env.AI_USAGE_SYNC_DISABLED || "");
const SYNC_INTERVAL_MS = Number(process.env.AI_USAGE_SYNC_INTERVAL_MS || 2 * 60 * 60 * 1000);
const SYNC_ON_BOOT = /^(1|true|yes)$/i.test(process.env.AI_USAGE_SYNC_ON_BOOT || "");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", createRoutes(ROOT));

// 生产环境：托管前端构建产物
const distDir = path.join(ROOT, "frontend", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Requirements board backend listening at http://${HOST}:${PORT}`);
  console.log(`  data dir: ${path.join(ROOT, "data")}`);
});

if (SYNC_DISABLED) {
  console.log("[ai-usage] 自动同步已禁用（AI_USAGE_SYNC_DISABLED）");
} else if (!Number.isFinite(SYNC_INTERVAL_MS) || SYNC_INTERVAL_MS < 60_000) {
  console.log(`[ai-usage] 自动同步间隔非法（${process.env.AI_USAGE_SYNC_INTERVAL_MS}），已禁用`);
} else {
  console.log(`[ai-usage] 自动同步间隔 ${SYNC_INTERVAL_MS}ms${SYNC_ON_BOOT ? "，启动后立即跑一次" : ""}`);

  const runOnce = async (trigger) => {
    try {
      const results = await syncAllAccounts(ROOT);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      console.log(`[ai-usage] ${trigger}：成功 ${ok}，失败 ${failed}`);
      results.filter((r) => !r.ok).forEach((r) => {
        console.warn(`[ai-usage]   ${r.accountId}: ${r.error}`);
      });
    } catch (err) {
      console.warn(`[ai-usage] ${trigger} 失败: ${err.message}`);
    }
  };

  if (SYNC_ON_BOOT) runOnce("启动同步");
  setInterval(() => runOnce("定时同步"), SYNC_INTERVAL_MS);
}