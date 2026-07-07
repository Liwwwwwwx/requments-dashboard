# TraceBoard V2 产品规划

更新时间：2026-07-07

## 1. 产品定位

TraceBoard V2 是一个前后端分离的项目需求看板，面向个人开发者、小团队和
AI Agent 协作场景。

它不做通用项目管理平台，也不做复杂企业后台。V2 的核心目标是：

> 登录后按项目管理需求，在需求上下文里查看状态、记录变更，并让 AI 小助手
> 基于当前项目或需求给出建议。

第一版只解决三个问题：

- 项目里的需求现在有哪些。
- 每个需求现在是什么状态、谁负责、下一步是什么。
- AI 能不能基于当前项目/需求上下文帮我总结、拆解和提建议。

## 2. 风格参考

### 参考来源

- 墨刀原型：`https://modao.cc/proto/design/pb2mqton5wg7bvmro`
  - 页面标题：Arco Design Pro B端管理后台
  - 可访问，主要展示 Arco Pro 风格的 B 端后台布局。
- Arco Design Pro：`https://pro.arco.design/`
- Ant Design / ProComponents：`https://ant.design/`、`https://procomponents.ant.design/`

### 可借鉴点

- 左侧稳定导航，主内容区承载主要工作流。
- 浅灰页面背景 + 白色内容面板。
- 蓝色作为主色，用于导航选中、按钮和关键状态。
- 表格、卡片、筛选区清晰分层。
- 信息密度偏高，但保持行距、留白和边界清楚。

### 不照搬点

- 不做大量图表型 Dashboard。
- 不做复杂多级菜单。
- 不做“管理后台大全”式导航。
- 不把第一屏做成指标大屏。
- 不做过多装饰性卡片。

## 3. V2 页面结构

### 总体布局

```text
┌──────────────────────────────────────────────┐
│ Top Bar：当前项目 / 搜索 / 用户入口           │
├──────────────┬───────────────────────────────┤
│ 左侧导航      │ 主内容区                       │
│ 项目列表      │ 需求看板 / 需求详情 / AI 助手    │
│ 当前项目菜单  │                               │
└──────────────┴───────────────────────────────┘
```

### 导航层级

第一版导航只保留：

- 项目
- 需求看板
- AI 小助手
- 设置

暂不出现：

- 管理后台
- 数据大屏
- 跨项目指挥台
- 周报/月报
- Agent 执行中心

## 4. 页面规划

### 4.1 登录页

目标：让用户快速进入系统，不承载产品介绍。

内容：

- 产品名：TraceBoard
- 用户名输入
- 密码输入
- 登录按钮
- 简短错误提示

设计要求：

- 页面干净，居中登录面板。
- 不做复杂宣传文案。
- 不展示敏感配置。

### 4.2 项目页 / 项目切换

目标：明确当前正在处理哪个项目。

能力：

- 查看项目列表。
- 创建项目。
- 切换当前项目。

V1 交互建议：

- 左侧顶部放当前项目下拉。
- 项目为空时展示空状态和“创建项目”按钮。
- 不做项目成员权限。

### 4.3 需求看板

目标：这是主工作台。

默认视图建议使用列表 + 状态列混合形态：

- 左侧/顶部筛选区：状态、优先级、负责人、关键词。
- 主区：需求列表。
- 需求行展示：
  - 标题
  - 状态
  - 优先级
  - 负责人
  - 更新时间
  - 简短描述

状态第一版只保留：

- `todo`
- `doing`
- `blocked`
- `done`

优先级第一版只保留：

- `P0`
- `P1`
- `P2`

不做：

- 甘特图
- 复杂工作流
- 自定义字段
- 多视图配置

### 4.4 需求详情页

目标：一个需求的上下文中心。

页面结构：

```text
┌──────────────────────────────────────────────┐
│ 需求标题 / 状态 / 优先级 / 操作按钮           │
├──────────────────────┬───────────────────────┤
│ 基础信息              │ AI 小助手              │
│ 描述                  │ 当前需求上下文问答      │
│ 负责人                │ 建议拆解/总结/下一步    │
│ 状态                  │                       │
├──────────────────────┴───────────────────────┤
│ 变更历史 / 备注                                │
└──────────────────────────────────────────────┘
```

第一版字段：

- 标题
- 描述
- 状态
- 优先级
- 负责人
- 创建时间
- 更新时间

变更历史：

- 记录需求创建。
- 记录字段修改。
- 记录状态变化。
- 记录备注。

### 4.5 AI 小助手

目标：作为当前项目/需求的上下文助手，而不是自动执行系统。

入口：

- 项目级 AI：基于当前项目需求列表回答问题。
- 需求级 AI：基于当前需求详情和历史回答问题。

第一版能力：

- 总结当前项目需求。
- 总结当前需求。
- 帮忙拆解下一步。
- 根据描述生成需求草稿。
- 给出状态推进建议。

第一版限制：

- AI 不直接修改数据库。
- AI 不自动创建需求。
- AI 若要修改，只能生成“建议变更”。
- 用户确认后再由普通 API 写入。

## 5. 产品范围

### MVP 必做

- 登录。
- 项目列表和创建项目。
- 按项目查看需求。
- 新建需求。
- 编辑需求基础字段。
- 修改需求状态。
- 查看需求详情。
- 查看需求变更历史。
- AI 小助手读取项目/需求上下文并回答。

### MVP 暂不做

- 注册。
- 多角色权限。
- 管理后台。
- 跨项目指挥台。
- Dashboard。
- Agent run。
- Flow catalog。
- 审批流。
- 周报/月报。
- 通知系统。
- 文件上传。
- 甘特图。

## 6. 数据模型草案

V2 要直接走数据库，不再以 JSONL 作为主存储。

第一版建议 SQLite 起步，模型预留迁移到 Postgres 的空间。

```text
users
- id
- username
- password_hash
- role
- created_at
- updated_at

projects
- id
- name
- description
- created_at
- updated_at

requirements
- id
- project_id
- title
- description
- status
- priority
- owner
- created_by
- created_at
- updated_at

requirement_events
- id
- project_id
- requirement_id
- type
- payload_json
- actor_id
- created_at

ai_conversations
- id
- project_id
- requirement_id nullable
- user_id
- title
- created_at
- updated_at

ai_messages
- id
- conversation_id
- role
- content
- created_at
```

## 7. API 边界草案

前后端分离，但接口保持少。

```text
POST /auth/login
POST /auth/logout
GET  /auth/me

GET  /projects
POST /projects
GET  /projects/:projectId
PATCH /projects/:projectId

GET  /projects/:projectId/requirements
POST /projects/:projectId/requirements
GET  /projects/:projectId/requirements/:requirementId
PATCH /projects/:projectId/requirements/:requirementId

GET  /projects/:projectId/requirements/:requirementId/events
POST /projects/:projectId/requirements/:requirementId/events

POST /ai/chat
GET  /ai/conversations
GET  /ai/conversations/:conversationId/messages
```

## 8. 技术建议

### 推荐结构

```text
apps/
  web/      前端
  api/      后端
packages/
  shared/   共享类型、schema、常量
```

### 推荐技术栈

- 前端：Next.js 或 Vite React。
- 后端：Express 或 Fastify。
- 数据库：SQLite 起步，后续迁移 Postgres。
- ORM：Prisma 或 Drizzle 二选一。
- UI：优先 Ant Design / Arco 风格，不混用多个 UI 库。
- AI：只在后端调用模型，前端不持有 API Key。

### 架构原则

- 前后端分离，但不要过早平台化。
- 先做业务闭环，再做治理能力。
- 数据库是事实来源。
- AI 是助手，不是自动执行器。
- 页面优先服务高频操作，不做营销式首页。

## 9. 视觉规范草案

### 颜色

- 背景：浅灰。
- 主面板：白色。
- 主色：蓝色。
- 危险状态：红色。
- 阻塞状态：橙色或红色。
- 完成状态：绿色。

### 布局

- 左侧导航宽度固定。
- 主内容区最大化利用横向空间。
- 需求详情可使用右侧 AI 固定栏。
- 页面间距稳定，避免卡片套卡片。

### 组件

- 表格用于需求列表。
- Tag 用于状态和优先级。
- Drawer 或右侧栏用于 AI 小助手。
- Modal 用于新建/编辑需求。
- Empty 用于空项目和空需求状态。

## 10. 第一版验收标准

V2 MVP 完成时，应该能做到：

1. 用户可以登录系统。
2. 用户可以创建项目。
3. 用户可以在项目下创建需求。
4. 用户可以查看需求列表。
5. 用户可以进入需求详情。
6. 用户可以修改需求状态和基础字段。
7. 系统会记录需求变更历史。
8. AI 小助手可以基于当前项目或需求回答问题。
9. AI 不会绕过用户确认直接修改数据。
10. 所有核心数据都来自数据库。

## 11. 当前决策

- 重新写 V2，而不是继续扩展当前版本。
- 当前版本保留为参考和原型材料。
- V2 先做产品规划，再写技术方案。
- 第一阶段不追求功能多，追求登录、项目、需求、AI 上下文这条主链稳定。
