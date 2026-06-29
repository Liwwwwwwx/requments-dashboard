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
