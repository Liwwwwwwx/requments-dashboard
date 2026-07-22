// JWT secret 必须在模块加载前设置（tokens.js 在顶层检查环境变量）
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-' + Math.random().toString(36).slice(2);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-' + Math.random().toString(36).slice(2);

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';

// 使用同步 require 替代顶层 import，因为 vitest 会 hoist import 在 process.env 之前
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoutes } = require('../src/routes');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { errorMiddleware } = require('../src/errors');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { query } = require('../src/postgres');
const request = require('supertest');

let tmpDir: string;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', createRoutes(tmpDir));
  app.use(errorMiddleware());
  return app;
}

async function cleanRateLimit() {
  try { await query("DELETE FROM login_attempts"); } catch { /* ignore */ }
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-auth-test-'));
  // 清理 login_attempts 避免跨测试限流污染
  await cleanRateLimit();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('auth routes', () => {
  it('logs in default user and reads current user with access token', async () => {
    const app = makeApp();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      ok: true,
      user: expect.objectContaining({ username: 'admin', role: 'owner' })
    });
    expect(typeof login.body.accessToken).toBe('string');
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.headers['set-cookie'][0]).toContain('refresh_token=');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      ok: true,
      user: expect.objectContaining({ username: 'admin', role: 'owner' })
    });
  });

  it('refreshes access token from cookie and returns user', async () => {
    const app = makeApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(login.status).toBe(200);

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', login.headers['set-cookie']);

    expect(refresh.status).toBe(200);
    expect(refresh.body.ok).toBe(true);
    expect(typeof refresh.body.accessToken).toBe('string');
    expect(refresh.body.user).toMatchObject(
      expect.objectContaining({ username: 'admin', role: 'owner' })
    );
    expect(refresh.headers['set-cookie']).toBeDefined();
    expect(refresh.headers['set-cookie'][0]).toContain('refresh_token=');

    const projects = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${refresh.body.accessToken}`);

    expect(projects.status).toBe(200);
    expect(projects.body).toEqual({ ok: true, projects: [] });
  });

  it('rejects wrong password with unified error format', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      code: 'INVALID_CREDENTIALS',
      message: expect.any(String)
    });
  });

  it('keeps registration disabled unless explicitly enabled', async () => {
    const app = makeApp();

    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'new-user', password: 'secret123' });
    expect(register.status).toBe(403);
    expect(register.body).toMatchObject({
      ok: false,
      code: 'REGISTRATION_DISABLED',
      message: expect.any(String)
    });

    const password = await request(app)
      .put('/api/auth/password')
      .send({ oldPassword: 'admin123', newPassword: 'secret123' });
    expect(password.status).toBe(404);
  });

  it('registers a member when registration is enabled', async () => {
    const previous = process.env.ALLOW_REGISTRATION;
    process.env.ALLOW_REGISTRATION = 'true';
    try {
      const uniqueUser = `test-user-${Date.now()}`;
      const register = await request(makeApp())
        .post('/api/auth/register')
        .send({ username: uniqueUser, password: 'secret123', displayName: '测试成员' });

      expect(register.status).toBe(201);
      expect(register.body).toMatchObject({
        ok: true,
        user: { username: uniqueUser, displayName: '测试成员', role: 'member' }
      });
      expect(typeof register.body.accessToken).toBe('string');
      expect(register.headers['set-cookie']).toBeDefined();
      expect(register.headers['set-cookie'][0]).toContain('refresh_token=');
    } finally {
      if (previous === undefined) delete process.env.ALLOW_REGISTRATION;
      else process.env.ALLOW_REGISTRATION = previous;
    }
  });

  it('returns 400 for missing credentials with unified error format', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      code: 'MISSING_CREDENTIALS',
      message: expect.any(String)
    });
  });

  // --- refresh token rotation tests ---

  it('revokes the old refresh token on rotation', async () => {
    const app = makeApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(login.status).toBe(200);
    const firstCookie = login.headers['set-cookie'];

    // 第一次刷新 — 成功
    const refresh1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);

    expect(refresh1.status).toBe(200);
    const secondCookie = refresh1.headers['set-cookie'];

    // 用第一次的旧 cookie 再次刷新 — 应该失败（token 已被轮换撤销）
    const refresh2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);

    expect(refresh2.status).toBe(401);
  });

  it('revokes entire token family on suspected replay attack', async () => {
    const app = makeApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(login.status).toBe(200);
    const firstCookie = login.headers['set-cookie'];

    // 用第一个 token 刷新拿到第二个
    const refresh1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);
    expect(refresh1.status).toBe(200);
    const secondCookie = refresh1.headers['set-cookie'];

    // 用第二个 token 刷出第三个
    const refresh2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie);
    expect(refresh2.status).toBe(200);

    // 用已被轮换掉的第一个 token 重放 — revoked 时已触发 family 全部撤销
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);
    expect(replay.status).toBe(401);

    // 第三个 token（最新的）也应该无法使用
    const thirdCookie = refresh2.headers['set-cookie'];
    const afterCompromise = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', thirdCookie);
    expect(afterCompromise.status).toBe(401);
  });

  it('logs out and invalidates refresh token', async () => {
    const app = makeApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(logout.status).toBe(200);
    expect(logout.body.ok).toBe(true);

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(refresh.status).toBe(401);
  });

  // --- rate limiting tests ---

  it('blocks login after 5 consecutive failures for the same user', async () => {
    const app = makeApp();

    // 5 次失败
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ratelimit-block', password: 'wrong' });

      expect(res.status).toBe(401);
    }

    // 第 6 次 — 被限流
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ratelimit-block', password: 'admin123' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('LOGIN_RATE_LIMITED');
  });
});
