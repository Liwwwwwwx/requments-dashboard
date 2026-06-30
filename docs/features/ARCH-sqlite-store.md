# 功能：事件存储切换 SQLite

| 字段 | 值 |
|------|-----|
| 编号 | ARCH-sqlite-store |
| 状态 | done |
| 创建 | 2026-06-30 |
| 作者 | liwwwwwwx |
| 依赖 | 无 |

## 1. 目标与动机

将事件存储从 JSONL 文件切换到 SQLite，提升查询性能并保留事件溯源模式。

## 2. 用户场景

- 作为开发者，我需要按需求查询历史事件，而不是每次全量读取 10MB JSONL。
- 作为系统，我需要并发写入安全（WAL 模式）而不是文件锁。

## 3. 前端范围

无前端变更，对外 API 保持兼容。

## 4. 后端范围

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:project/events` | 返回保持不变 |
| POST | `/api/projects/:project/events` | 写入路径改为 SQLite |

### 数据模型

```sql
CREATE TABLE events (
  id              TEXT PRIMARY KEY,
  ts              INTEGER NOT NULL,
  kind            TEXT NOT NULL,
  project         TEXT,
  requirement_id  TEXT,
  task_id         TEXT,
  actor           TEXT,
  payload         TEXT NOT NULL
);
```

### 涉及文件

```text
backend/src/
├── db.js           (新增) SQLite 连接、迁移、读写
├── events.js       (修改) 适配 db 层
├── state.js        (修改) 从 db 读取事件后渲染
└── index.js        (不变)
```

## 5. API 契约

无新增 API，现有接口响应格式不变。

## 6. 实现步骤

- [x] 1. 后端：新建 `db.js`，封装 openDb/eventToRow/rowToEvent/migrateFromJsonl
- [x] 2. 后端：`events.js` 改为调用 db 层
- [x] 3. 后端：`state.js` 适配新的事件结构
- [x] 4. 后端：`projects.js` eventsPath 改为 .db 扩展名
- [x] 5. 测试：schema/events/state 全套测试通过

## 7. 验收标准

- [x] 前/后端构建 0 错误
- [x] 6 项 schema 测试通过
- [x] 旧 jsonl 自动迁移到 db，不丢数据
- [x] 读写/渲染/锁行为与 JSONL 版本一致
