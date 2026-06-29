"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createRoutes } = require("./routes");

const ROOT = process.env.REQUIREMENTS_ROOT || path.resolve(__dirname, "..", "..");
const HOST = process.env.REQUIREMENTS_HOST || "127.0.0.1";
const PORT = Number(process.env.REQUIREMENTS_PORT || 4315);

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
