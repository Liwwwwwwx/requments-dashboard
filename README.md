# Requirements Board

多项目需求看板，支持多个项目共用同一实例管理需求、子任务和接口契约。

## 技术栈

- 前端：React 18 + Vite 5 + Ant Design 5
- 后端：Node 18+ + Express 4 + JSONL 事件流
- 数据：按项目分文件存储 (`data/<project>/events.jsonl`)

## 快速开始

```bash
cd requirements-board
npm run install:all
npm run migrate        # 从 REQUIREMENTS/data/events.jsonl 迁移现有数据
npm run dev            # 同时启动前后端
```

访问：http://127.0.0.1:5173

后端 API：http://127.0.0.1:4315

## 常用命令

```bash
# 新建需求（默认项目 default）
npm run req -- new --project default --title "..." --summary "..." --priority P1

# 更新需求状态
npm run req -- status --project default REQ-0001 doing --workflow frontend-working

# 添加子任务
npm run req -- task-add --project default REQ-0001 FE-2 frontend "按钮交互补齐"

# 更新子任务状态
npm run req -- task-status --project default REQ-0001 FE-1 working --agent Agent-B --verify "yarn lint"

# 设置接口契约
npm run req -- contract-set --project default REQ-0001 --endpoints '[{"method":"POST","path":"/api/..."}]'

# 查看需求
npm run req -- show --project default REQ-0001

# 重新渲染状态
npm run req -- render --project default
```

## 产品方案

- [Requirements Board PRD](docs/PRODUCT_REQUIREMENTS.md)

## API 路由

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 新建项目 |
| GET | `/api/projects/:project/state` | 看板状态 |
| GET | `/api/projects/:project/events` | 原始事件流 |
| POST | `/api/projects/:project/events` | 追加事件 |
| POST | `/api/projects/:project/render` | 重新渲染 |
| GET | `/api/ai-usage/state` | AI 用量聚合 |
| POST | `/api/ai-usage/accounts` | 新增/更新 AI 账号 |
| POST | `/api/ai-usage/test` | 测试 AI 账号连通性 |
| POST | `/api/ai-usage/snapshots` | 手动追加快照 |
| POST | `/api/ai-usage/accounts/:id/sync` | 同步单个账号 |

## 前端路由

| 路径 | 视图 |
|---|---|
| `/` | 重定向到 `/p/default` |
| `/p/:project` | 需求列表 |
| `/p/:project/r/:reqId` | 需求详情 |
| `/ai-usage` | AI 用量看板 |

AI 用量定时同步（默认 2h）通过后端环境变量控制：

- `AI_USAGE_SYNC_CRON`：每日触发时间（`HH:MM`），默认 `08:00`，时区 `Asia/Shanghai`
- `AI_USAGE_SYNC_INTERVAL_MS`：按毫秒循环，>0 时覆盖 cron（兼容旧用法）
- `AI_USAGE_SYNC_DISABLED=1`：关闭
- `AI_USAGE_SYNC_ON_BOOT=1`：启动后立即跑一次

「今日消耗」语义：以「今天 ≥ 08:00 的最早一次有效快照」为起点，减去当前最新一次快照的值；08:00 自动同步前，前端不会显示「今日消耗」数字，第二天 08:00 同步后即重置为 0 重新累计。

## 目录结构

```
requirements-board/
├── backend/
│   ├── src/            # Express 服务、事件流、状态渲染、校验
│   ├── scripts/
│   │   └── migrate.js  # 数据迁移脚本
│   └── cli.js          # 命令行工具
├── frontend/
│   └── src/            # React + AntD 看板组件
└── data/               # 运行时数据
│   └── src/            # React + AntD 看板组件
└── package.json
```

## 数据规则

- 唯一事实源：`data/<project>/events.jsonl`
- 生成物：`data/<project>/state.json`、`data/<project>/state.js`
- 所有写入必须通过 CLI 或 API，禁止手工改 `state.json`

## 事件字段

统一使用 `kind`：

- `req.new` / `req.status` / `req.patch`
- `task.new` / `task.status`
- `contract.set`
- `note.add`
