# Requirements Board PRD

> 文档状态：历史参考。
>
> 本文记录的是 V1 / 旧版 Requirements Board 的产品设想，包含 Task、
> Contract、Agent 执行、JSONL 事实源等已从 V2 MVP 中移出的概念。
> 当前开发请以 `docs/TRACEBOARD_V2_PRODUCT_PLAN.md` 和
> `docs/TRACEBOARD_V2_IMPLEMENTATION_STATUS.md` 为准。

## 1. 产品定位

Requirements Board 是一个面向多项目研发协同的需求工作台。

它不是通用 Todo、普通看板或 Jira 克隆。核心目标是围绕一个需求，把需求背景、角色子任务、接口契约、Agent 执行记录、验收状态和历史事件放在同一个上下文里推进。

核心链路：

```text
Project -> Requirement -> Task -> Event
```

当前项目已经具备基础实现：

- 前端：React + Vite + Ant Design
- 后端：Express + JSONL 事件流
- 数据：`data/<project>/events.jsonl` 作为唯一事实源
- 快照：`data/<project>/state.json`

下一阶段要解决的问题是页面使用逻辑，而不是先扩展更多字段。

## 2. 参考产品

这些产品可以作为交互和模型参考，但不建议直接照搬：

- Linear：适合参考 issue、parent issue、sub-issues、project 的轻量工程协作模型。
- Jira Product Discovery：适合参考 idea 到 delivery tickets 的需求与交付分层。
- Plane：适合参考开源项目管理工具的多视图、模块、周期和筛选体验。
- OpenProject：适合参考传统项目管理里的 work package、roadmap、agile board 和里程碑。

本项目差异点：

- 需求是主上下文，不是任务是主上下文。
- 任务按研发角色固定分组，而不是任意列表。
- 事件流是一级能力，所有状态变化需要可追溯。
- Agent 写入事件是核心入口，不只是人手动编辑。
- Contract / Review / QA / Integration 是研发闭环的一部分。

## 3. 目标用户

### 3.1 项目负责人

需要快速知道：

- 每个项目当前有哪些需求。
- 哪些需求阻塞。
- 哪些角色任务还没完成。
- 下一步应该让哪个 Agent 或人接手。

### 3.2 开发 Agent / 人类开发者

需要快速知道：

- 当前需求的上下文。
- 自己负责的任务。
- 任务完成标准。
- 相关接口契约。
- 应该写入什么状态事件。

### 3.3 Review / QA 角色

需要快速知道：

- 前后端是否按契约完成。
- 关键验收项是否覆盖。
- 测试失败或联调问题记录在哪里。

## 4. 核心对象

### 4.1 Project

表示一个可独立管理的研发项目。

必需字段：

- `id`
- `name`
- `description`
- `status`
- `createdAt`
- `updatedAt`

当前实现中项目由目录 `data/<project>` 表示。MVP 可以继续保留文件存储，但 UI 中要把项目作为一级入口展示。

### 4.2 Requirement

表示一个需求、修复、重构或交付目标。

必需字段：

- `id`
- `title`
- `summary`
- `type`
- `status`
- `workflowStatus`
- `priority`
- `owner`
- `week`
- `dueDate`
- `updatedAt`
- `detail`
- `acceptance`
- `taskStats`

Requirement 是页面主上下文。

### 4.3 Task

表示需求下的角色子任务。

固定角色：

- `contract`
- `frontend`
- `backend`
- `review`
- `qa`
- `integration`
- `infra`
- `general`

必需字段：

- `taskId`
- `role`
- `title`
- `scope`
- `status`
- `agent`
- `verify`
- `notes`
- `files`

Task 不应该脱离 Requirement 成为页面主视图。全局任务列表可以以后作为搜索/报告能力，但不是 MVP 主交互。

### 4.4 Event

表示系统的事实记录。

当前事件类型：

- `req.new`
- `req.status`
- `req.patch`
- `task.new`
- `task.status`
- `contract.set`
- `note.add`

事件原则：

- append-only
- 不手写 `state.json`
- UI、CLI、Agent API 都只追加事件
- 快照由 render 生成

## 5. 页面信息架构

### 5.1 当前问题

截图暴露的问题：

- 页面右侧出现大面积空白，选中需求没有成为主上下文。
- 左侧像一个搜索结果列表，而不是需求推进工作台。
- 顶部统计占据较多空间，但没有给出下一步动作。
- 全局任务视图会打散需求和任务的关系。
- 项目选择器存在，但项目上下文不够强。

### 5.2 目标结构

MVP 推荐三栏结构：

```text
Top Bar
  Project Switcher / Global Search / Refresh

Left Rail
  Requirement List

Main Workbench
  Current Requirement
  Role-grouped Tasks

Right Inspector
  Details / Tasks / Contract / History
```

在窄屏下可以降级：

```text
Requirement List
Current Requirement Workbench
Inspector Tabs
```

### 5.3 顶部区域

保留：

- 项目切换
- 刷新
- 全局搜索

压缩：

- 统计卡改为小型状态条，不要占据一整行大卡片。

状态条建议：

```text
全部 10 | 待开始 3 | 进行中 1 | 阻塞 0 | 完成 6
```

### 5.4 左侧：需求列表

职责：

- 扫描项目内需求。
- 快速选择当前需求。
- 支持基础筛选。

显示字段：

- `REQ-xxxx`
- priority
- status
- title
- owner
- progress
- updatedAt

交互：

- 点击需求 -> 设置当前需求
- 不在左侧展开完整任务树
- 可以显示少量任务摘要，例如 `3/7`、阻塞数

### 5.5 中间：当前需求工作台

职责：

- 展示当前需求的完整推进状态。
- 任务按角色分组。
- 让用户一眼看到每个角色做到哪里。

模块顺序：

1. 需求头
2. 摘要和下一步
3. 角色任务组
4. 阻塞项
5. 验收状态

任务组固定顺序：

```text
contract -> frontend -> backend -> review -> qa -> integration -> infra
```

每条任务显示：

- taskId
- status
- agent
- title
- verify 摘要

点击任务：

- 右侧 Inspector 打开任务详情。

### 5.6 右侧：Inspector

职责：

- 展示当前需求或当前任务的深层信息。

Tabs：

- `详情`
- `任务`
- `契约`
- `历史`
- `备注`

MVP 优先级：

1. `详情`
2. `任务`
3. `契约`
4. `历史`

`任务` Tab 只显示当前需求的任务，不显示全局任务。

`历史` Tab 从 `/api/projects/:project/events` 读取，按 `requirementId` 过滤。

## 6. 关键用户流程

### 6.1 查看项目进度

1. 用户进入页面。
2. 选择项目。
3. 左侧看到该项目需求列表。
4. 中间默认展示最近更新或最高优先级需求。
5. 用户查看每个角色任务状态。

### 6.2 推进一个需求

1. 用户选择 `REQ-xxxx`。
2. 中间看到需求摘要、下一步和角色任务。
3. 点击 `frontend` 或 `backend` 任务。
4. 右侧展示任务详情、scope、verify、notes。
5. Agent 或 CLI 写入 `task.status`。
6. 页面刷新后状态更新。

### 6.3 排查阻塞

1. 用户筛选 `blocked`。
2. 左侧只展示含阻塞状态的需求。
3. 中间展示当前需求的阻塞任务。
4. 右侧历史展示最近相关事件。

### 6.4 验收需求

1. Review / QA 查看需求。
2. 检查 Contract / Review / QA / Integration 任务。
3. 所有任务完成后写入 `req.status done`。
4. `state.json` 重新生成。

## 7. MVP 范围

### 7.1 必须做

- 三栏页面结构。
- 左侧只显示需求列表。
- 中间显示当前需求工作台。
- 右侧显示详情/任务/契约/历史。
- 任务只在当前需求上下文展示。
- 项目切换后清空旧选择。
- 事件历史按需求过滤。
- 保留 JSONL 存储。

### 7.2 暂不做

- 登录和权限系统。
- 数据库迁移。
- 甘特图。
- 通用 Kanban。
- 自定义字段配置。
- 多团队组织架构。
- 自动通知。
- WebSocket 实时刷新。

## 8. 数据与 API

当前 API 可以支撑 MVP：

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:project/state`
- `GET /api/projects/:project/events`
- `POST /api/projects/:project/events`
- `POST /api/projects/:project/render`

建议补充：

```text
GET /api/projects/:project/requirements/:requirementId
GET /api/projects/:project/requirements/:requirementId/events
POST /api/projects/:project/requirements/:requirementId/tasks/:taskId/status
POST /api/projects/:project/requirements/:requirementId/notes
```

这些不是必须，但能让前端和 Agent API 更清晰。

## 9. 当前代码重构计划

### 阶段 1：修正页面结构

目标：

- 修复当前右侧空白和布局问题。
- 从两栏改成三栏。
- 让当前需求成为主上下文。

涉及文件：

- `frontend/src/App.jsx`
- `frontend/src/components/RequirementList.jsx`
- `frontend/src/components/RequirementDetail.jsx`
- 新增 `RequirementWorkbench.jsx`
- 新增或重构 `RequirementInspector.jsx`
- `frontend/src/styles.css`

### 阶段 2：当前需求任务工作台

目标：

- 中间工作台按角色分组任务。
- 每个角色显示完成数、阻塞数、进行中任务。
- 点击任务联动右侧 Inspector。

### 阶段 3：历史和契约 Tab

目标：

- 右侧支持事件历史。
- 契约独立成 Tab。
- 历史事件按类型格式化。

### 阶段 4：Agent 写入体验

目标：

- 文档化 Agent 追加事件协议。
- 给每个任务生成可复制的 CLI/API 命令。
- 后续可接 Codex/Claude/Kimi 执行记录。

## 10. 验收标准

### 页面层

- 进入页面后不会出现大面积无意义空白。
- 默认选中一个需求。
- 用户能在一屏内看到当前需求、子任务状态和详情入口。
- 任务不会脱离需求上下文展示。
- 项目切换后不会残留上一个项目的选中任务。

### 数据层

- 所有写入仍通过事件。
- `state.json` 可由 events 完整重建。
- 旧数据迁移后仍可正常展示。

### 工程层

- `npm run test:schema` 通过。
- `npm run build` 通过。
- 不引入新 UI 库。
- 不引入数据库。

## 11. 后续路线

短期：

- 完成三栏工作台重构。
- 增加历史 Tab。
- 整理 Agent 写入事件文档。

中期：

- 增加需求模板。
- 增加项目级 dashboard。
- 支持导入多个旧项目。

长期：

- 从 JSONL 迁移到 Postgres。
- 增加用户和权限。
- 增加实时刷新和通知。
