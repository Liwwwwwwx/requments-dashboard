# TraceBoard

TraceBoard 是一个轻量的项目需求看板，帮助个人开发者和小团队按项目管理需求，并在项目或需求上下文中使用 AI 小助手。

## 功能

- 登录与登录态刷新。
- 项目创建、切换和基础信息维护。
- 需求创建、编辑、筛选、状态流转、备注和变更历史。
- 项目级与需求级 AI 对话；AI 仅生成建议，须经用户确认后才会写入需求数据。

## 技术栈

- 前端：Next.js 15、TypeScript、Ant Design 5、Vitest。
- 后端：Node.js 18+、Express 4、SQLite（better-sqlite3）。
- 数据：按项目隔离，默认存放在 `data/<project>/events.db`。

## 启动

```bash
npm run install:all
npm run dev
```

- 前端：http://127.0.0.1:5173
- 后端 API：http://127.0.0.1:4315

前端会将 `/api/*` 请求代理到后端。

## 常用命令

```bash
npm run dev:backend
npm run dev:frontend
npm run test:backend
npm run test:frontend
npm run lint
npm run typecheck
```

## 页面

| 路径 | 说明 |
| --- | --- |
| `/login` | 登录 |
| `/p/:project` | 项目需求看板 |
| `/p/:project/r/:reqId` | 需求详情 |
| `/p/:project/ai` | 项目 AI 小助手 |
| `/p/:project/settings` | 项目设置 |

## API 概览

| 方法 | 路由 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |
| `GET` / `POST` | `/api/projects` | 查询或创建项目 |
| `GET` / `PATCH` | `/api/projects/:project` | 查询或更新项目 |
| `GET` / `POST` | `/api/projects/:project/requirements` | 查询或创建需求 |
| `GET` / `PATCH` | `/api/projects/:project/requirements/:id` | 查询或更新需求 |
| `GET` / `POST` | `/api/projects/:project/requirements/:id/events` | 查询历史或写入需求事件 |

## 开发文档

功能开发约定与历史功能记录见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
