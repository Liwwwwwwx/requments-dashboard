# 云服务器部署与数据库迁移

## 一次性准备

在托管 PostgreSQL 服务或服务器上的 PostgreSQL 创建一个独立数据库和最小权限账号。
将连接串只写入服务器的 `ecosystem.secrets.cjs`：

```js
module.exports = {
  backendEnv: {
    DATABASE_URL: "postgresql://USER:PASSWORD@HOST:5432/traceboard?sslmode=require",
    ALLOW_REGISTRATION: "true",
    COOKIE_SECURE: "true",
    JWT_ACCESS_SECRET: "替换为随机长字符串",
    JWT_REFRESH_SECRET: "替换为另一随机长字符串"
  }
};
```

不要提交该文件、连接串或 JWT 密钥。若 Nginx 在 HTTPS 终止，请确认它代理到 PM2 的后端端口。

执行首次结构迁移前，先备份现有数据：

```bash
cd /home/ubuntu/requments-dashboard
tar -czf ~/traceboard-data-$(date +%F-%H%M).tgz data
npm run db:migrate
```

`db:migrate` 会记录已执行的迁移文件；可安全重复运行，不会重建已有表。

在业务读写切换前，先验证 SQLite 导入源（不写入 PostgreSQL）：

```bash
DATABASE_URL='...' npm run db:import-sqlite -- --dry-run
```

正式导入只执行一次。导入器发现 PostgreSQL 已有应用数据会终止，避免重复写入：

```bash
DATABASE_URL='...' npm run db:import-sqlite
```

## 每次发布

```bash
cd /home/ubuntu/requments-dashboard
git pull --ff-only
npm ci
npm run db:migrate
npm run build
pm2 reload ecosystem.config.cjs --update-env
```

数据库是线上唯一事实源。开发环境必须使用独立的 `DATABASE_URL`，不要让本地环境连接生产库。

## 当前迁移状态

本提交已提供 PostgreSQL 表结构和迁移执行器，并新增可开关的注册接口。业务事件读写仍使用现有 SQLite；在导入现有 SQLite 数据并切换运行时前，不要删除服务器 `data/` 目录。
