# TraceBoard

TraceBoard 是一个面向 V2 重写前的最小需求管理原型，核心目标是把项目、需求看板、需求详情和 AI 小助手先跑通。

## 当前范围

- 登录后进入项目工作区。
- 按项目管理需求列表、需求详情和项目基础信息。
- 需求支持创建、编辑、状态流转、备注和变更历史。
- AI 小助手围绕当前项目或当前需求给出建议，并可提案修改需求状态、需求字段或添加备注。
- 数据按项目隔离，后端使用 SQLite 文件存储。

## 技术栈

- 前端：Next.js 15 App Router + TypeScript + Ant Design 5 + Vitest。
- 后端：Node 18+ + Express 4 + better-sqlite3。
- 数据：`data/<project>/events.db`，每个项目一个 SQLite 文件。

## 快速开始

```bash
npm run install:all
npm run dev
```

访问：http://127.0.0.1:5173

后端 API：http://127.0.0.1:4315，前端通过 `/api/*` 重写代理。

## 常用命令

```bash
npm run dev:backend
npm run dev:frontend
npm run test:backend
npm run test:frontend
COREPACK_ENABLE_AUTO_PIN=0 yarn lint
```

## 主要路由

| 路径 | 说明 |
|---|---|
| `/login` | 登录页 |
| `/p/:project` | 项目需求看板 |
| `/p/:project/r/:reqId` | 需求详情 |
| `/p/:project/ai` | 项目 / 需求 AI 小助手 |
| `/p/:project/settings` | 项目设置 |

## 核心 API

| 方法 | 路由 | 说明 |
|---|---|---|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/projects` | 项目列表 |
| `POST` | `/api/projects` | 新建项目 |
| `GET` | `/api/projects/:project` | 项目详情 |
| `PATCH` | `/api/projects/:project` | 更新项目基础信息 |
| `GET` | `/api/projects/:project/state` | 看板状态 |
| `POST` | `/api/projects/:project/requirements` | 新建需求 |
| `GET` | `/api/projects/:project/requirements/:id` | 需求详情 |
| `PATCH` | `/api/projects/:project/requirements/:id` | 更新需求 |
| `POST` | `/api/projects/:project/requirements/:id/notes` | 添加备注 |
| `GET` | `/api/projects/:project/requirements/:id/events` | 需求变更历史 |

## 产品规划

V2 的长期目标、MVP 边界和后续路线见：

- [TraceBoard V2 Product Plan](docs/TRACEBOARD_V2_PRODUCT_PLAN.md)
