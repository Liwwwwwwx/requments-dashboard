/**
 * PM2 进程定义。
 *
 * 用法：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * 部署时会自动 restart 这两个进程（CI deploy job）。
 *
 * 注意：不要碰名为 ai-usage-backend 的进程（其他项目专用）。
 */

const fs = require("node:fs");
const path = require("node:path");

const secretsPath = path.join(__dirname, "ecosystem.secrets.cjs");
const secrets = fs.existsSync(secretsPath) ? require(secretsPath) : {};
const backendSecrets = secrets.backendEnv || {};

module.exports = {
  apps: [
    {
      name: "req-board-backend",
      cwd: "/home/ubuntu/requments-dashboard",
      script: "backend/src/index.js",
      interpreter: "node",
      env: {
        REQUIREMENTS_HOST: "0.0.0.0",
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
        ...backendSecrets
      },
      max_memory_restart: "300M",
      out_file: "/home/ubuntu/.pm2/logs/req-board-backend-out.log",
      error_file: "/home/ubuntu/.pm2/logs/req-board-backend-error.log",
      merge_logs: true
    },
    {
      name: "req-board-frontend",
      cwd: "/home/ubuntu/requments-dashboard/frontend",
      script: "/home/ubuntu/requments-dashboard/node_modules/.bin/next",
      args: "start -H 0.0.0.0 -p 5173",
      env: {
        NODE_ENV: "production"
      },
      max_memory_restart: "400M",
      out_file: "/home/ubuntu/.pm2/logs/req-board-frontend-out.log",
      error_file: "/home/ubuntu/.pm2/logs/req-board-frontend-error.log",
      merge_logs: true
    }
  ]
};
