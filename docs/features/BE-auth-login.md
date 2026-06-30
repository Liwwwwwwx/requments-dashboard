# 功能：用户登录与无感刷新

| 字段 | 值 |
|------|-----|
| 编号 | BE-auth-login |
| 状态 | proposed |
| 创建 | 2026-07-01 |
| 作者 | liwwwwwwx |
| 依赖 | ARCH-sqlite-store |

## 1. 目标与动机

为需求看板加入登录认证。用户凭密码登录后获得短期访问令牌，后端在令牌过期时通过 refresh token 自动续期，前端全程无感——用户不会看到"登录过期请重新登录"。

## 2. 用户场景

- 作为项目负责人，我登录后进入需求列表，长时间停留在页面也不会被踢出。
- 作为开发者，我在浏览器新标签直接打开 `/p/default/r/REQ-0001` 深链，如果已登录就正常进入，否则跳到登录页。
- 访问令牌过期后，前端自动无感刷新，页面上的数据请求不中断。

## 3. 前端范围

### 页面 / 路由

| 路由 | 说明 | 鉴权 |
|------|------|------|
| `/login` | 登录页，输入用户名+密码 | 公开 |
| `/p/*` | 需求看板所有子路由 | 需登录 |
| `/` | 首页，重定向到 `/p/default` | 需登录 |

### 组件

| 组件 | 用途 |
|------|------|
| `LoginPage` | 登录表单（用户名、密码、提交按钮、错误提示） |
| `AuthProvider` | Context Provider，暴露 `user/login/logout/loading` |
| `RouteGuard` | 客户端路由守卫，未登录跳 `/login` |

### 交互状态

| 状态 | UI 表现 |
|------|---------|
| 加载中 | 全屏 Spin，检查本地 token |
| 未登录 | 跳转 `/login` |
| 登录中 | 按钮 loading，禁用输入 |
| 登录失败 | 表单下方红色 Alert 显示错误原因 |
| 已登录 | 正常进入看板，toolbar 右上角显示用户名 + 退出按钮 |

### Token 刷新策略

- **access token** 存内存（React state），不存 localStorage
- **refresh token** 存 httpOnly cookie，JS 不可读
- fetch 拦截器：任意请求返回 401 → 自动调 `/api/auth/refresh` → 成功则重放原请求 → 失败则跳登录页
- 并发请求同时 401 时只发一次 refresh（锁机制）

### 涉及文件

```text
frontend/src/
├── app/login/page.tsx
├── components/AuthProvider.tsx
├── components/LoginPage.tsx
├── lib/auth.ts          ← fetch 拦截器 + refresh 锁 + token 管理
├── middleware.ts         ← Next.js middleware 路由保护
```

## 4. 后端范围

### API

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户名+密码 → access + refresh | 公开 |
| POST | `/api/auth/refresh` | cookie 中的 refresh → 新 access | 公开 |
| POST | `/api/auth/logout` | 清除 refresh cookie | 需登录 |
| GET | `/api/auth/me` | 返回当前用户信息 | 需登录 |
| * | `/api/*` | 所有业务接口加上鉴权中间件 | 需登录 |

### 数据模型

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,   -- bcrypt hash
  display_name TEXT,
  created_at   TEXT NOT NULL
);
```

refresh token 不存数据库，自包含在 JWT payload 中，过期即失效。

### JWT 设计

**access token**（JWT，15 分钟过期）：
```json
{ "sub": "user-id", "username": "admin", "iat": ..., "exp": ..., "type": "access" }
```

**refresh token**（JWT，7 天过期，存 httpOnly cookie）：
```json
{ "sub": "user-id", "iat": ..., "exp": ..., "type": "refresh" }
```

### 中间件

`authMiddleware`：解析 Authorization header 中的 Bearer token，验证后注入 `req.user`，失败返回 401。

### 涉及文件

```text
backend/src/
├── auth/
│   ├── routes.js       ← 登录/刷新/登出/me 路由
│   ├── middleware.js    ← JWT 鉴权中间件
│   ├── tokens.js       ← sign/verify access & refresh
│   └── users.js        ← 用户读写（SQLite）
├── routes.js           ← 挂载 /api/auth，业务路由加中间件
└── index.js            ← 不变
```

## 5. API 契约

### `POST /api/auth/login`

```json
// 请求
{
  "username": "admin",
  "password": "****"
}

// 响应 ok（同时 Set-Cookie: refresh_token=xxx; HttpOnly; Path=/api/auth; Max-Age=604800）
{
  "ok": true,
  "user": { "id": "u1", "username": "admin", "displayName": "管理员" },
  "accessToken": "eyJ..."
}

// 响应 error
{ "ok": false, "error": "用户名或密码错误" }
```

### `POST /api/auth/refresh`

```text
// 请求
Cookie: refresh_token=xxx

// 响应 ok（同时 Set-Cookie 更新 refresh_token）
{
  "ok": true,
  "accessToken": "eyJ..."
}

// 响应 error
{ "ok": false, "error": "REFRESH_EXPIRED" }
```

### `POST /api/auth/logout`

```text
// 响应
{ "ok": true }
// 同时 Set-Cookie 清除 refresh_token
```

### `GET /api/auth/me`

```text
Authorization: Bearer <accessToken>

// 响应 ok
{ "ok": true, "user": { "id": "u1", "username": "admin" } }
```

## 6. 实现步骤

- [ ] 1. 后端：`auth/tokens.js` — sign/verify JWT 工具函数
- [ ] 2. 后端：`auth/users.js` — SQLite 用户表 + 初始化默认 admin 账号
- [ ] 3. 后端：`auth/routes.js` — 登录/刷新/登出/me 四个接口
- [ ] 4. 后端：`auth/middleware.js` — JWT 鉴权中间件
- [ ] 5. 后端：`routes.js` — 挂载 auth 路由，业务接口加鉴权
- [ ] 6. 前端：`lib/auth.ts` — fetch 拦截器 + refresh 锁
- [ ] 7. 前端：`components/AuthProvider.tsx` — Context + 登录状态管理
- [ ] 8. 前端：`app/login/page.tsx` — 登录页
- [ ] 9. 前端：`middleware.ts` — Next.js 路由保护
- [ ] 10. 前端：toolbar 右上角加用户名 + 退出

## 7. 验收标准

- [ ] 后端 `POST /api/auth/login` 校验正确，返回 token
- [ ] 未登录访问 `/api/projects` 返回 401
- [ ] 携带有效 token 访问 `/api/projects` 正常返回
- [ ] access token 过期后 refresh 自动续期，前端无感知
- [ ] refresh token 过期后跳转登录页
- [ ] `/login` 页面 UI 正常，输入错误有提示
- [ ] 登录后直接深链访问 `/p/default/r/REQ-0001` 正常进入
- [ ] 退出后清除 token，回到登录页
- [ ] 不影响已有功能（需求/任务/事件读写正常）