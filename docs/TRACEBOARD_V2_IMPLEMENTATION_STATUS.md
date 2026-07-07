# TraceBoard V2 实施状态

更新时间：2026-07-08

来源：`docs/TRACEBOARD_V2_PRODUCT_PLAN.md`、当前分支 `codex/traceboard-v2`、前后端测试与近期提交。

## 已完成

- 登录主链：已有登录页、刷新登录态、受保护页面跳转和登录失败提示；覆盖见 `frontend/tests/app/LoginPage.test.tsx`、`frontend/tests/components/AuthProvider.test.tsx`、`backend/tests/auth.test.ts`。
- 项目主链：支持项目列表、创建项目、切换项目和项目基础信息维护；覆盖见 `frontend/tests/components/Sidebar.test.tsx`、`frontend/tests/components/ProjectSettingsView.test.tsx`、`backend/tests/routes.test.ts`。
- 需求看板：按项目读取需求，支持新建需求、状态/优先级/负责人筛选、列表视图、筛选空状态；覆盖见 `frontend/tests/components/RequirementGrid.test.tsx`、`frontend/tests/hooks/useRequirements.test.tsx`。
- 需求详情：展示标题、描述、状态、优先级、负责人、创建时间、更新时间、备注、变更历史和需求级 AI；覆盖见 `frontend/tests/components/RequirementDetailView.test.tsx`。
- 需求写入 API：V2 公开接口收敛到需求 REST API 和需求级 events API；旧版公开 state/render/project events 接口已移除；覆盖见 `backend/tests/routes.test.ts`。
- AI 小助手：支持项目级/需求级会话、读取消息、生成建议变更、用户确认后应用；覆盖见 `frontend/tests/components/ChatPanel.test.tsx`、`backend/tests/ai/routes.test.ts`、`backend/tests/ai/proposals.test.ts`。
- 数据来源：需求事件写入 `events.db`，公开需求读取会从事件数据库渲染状态；`state.json` 保留为渲染快照，不作为公开 API；覆盖见 `backend/tests/routes.test.ts`、`backend/tests/events.test.ts`、`backend/tests/db.test.ts`。

## 进行中

- V2 边界收敛：内部仍保留旧事件 schema 和旧 JSONL 迁移兼容，用于读取历史数据；公开 UI/API 已尽量隐藏旧版任务、契约、范围、周期等概念。
- 产品体验整理：当前页面已靠近 Arco/Ant Design 后台风格，但仍需要一轮实际浏览器走查来确认布局密度、移动端和空状态细节。

## 下一步

1. 浏览器走查登录、创建项目、新建需求、详情编辑、备注、AI 提案应用的完整主链。
2. 继续清理文档中的旧版 PRD 内容，避免 `docs/PRODUCT_REQUIREMENTS.md` 与 V2 规划冲突。
3. 评估是否保留内部 legacy task/contract schema；若 V2 重写不再需要历史兼容，再拆一个后端迁移/删除阶段。
4. 补齐 AI 配置页或账号状态的产品说明，明确第一版只允许后端保存和选择模型账号。

## 风险

- 当前版本仍是“V2 重写前的原型”，目录和部分内部命名保留历史痕迹；如果继续扩展，需控制范围，避免重新变复杂。
- AI 流式调用依赖实际模型配置，自动化测试覆盖协议和提案应用，但不能证明真实账号可用。
- 旧 `docs/PRODUCT_REQUIREMENTS.md` 仍描述 V1/旧版产品模型，后续以 `TRACEBOARD_V2_PRODUCT_PLAN.md` 和本文档为准。

## 暂不做

- 注册、多角色权限、管理后台、Dashboard、Agent run、Flow catalog、审批流、周报/月报、通知、文件上传、甘特图。
