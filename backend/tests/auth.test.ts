import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createRoutes } from '../src/routes';
import { errorMiddleware } from '../src/errors';
import { initUsers } from '../src/auth/users';

let tmpDir: string;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', createRoutes(tmpDir));
  app.use(errorMiddleware());
  return app;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-auth-test-'));
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
      user: { id: 'u1', username: 'admin', displayName: '管理员', role: 'owner' }
    });
    expect(typeof login.body.accessToken).toBe('string');
    expect(login.headers['set-cookie']?.[0]).toContain('refresh_token=');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      ok: true,
      user: { id: 'u1', username: 'admin', displayName: '管理员', role: 'owner' }
    });
  });

  it('refreshes access token from cookie and authorizes project API', async () => {
    const app = makeApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', login.headers['set-cookie']);

    expect(refresh.status).toBe(200);
    expect(refresh.body.ok).toBe(true);
    expect(typeof refresh.body.accessToken).toBe('string');
    expect(refresh.headers['set-cookie']?.[0]).toContain('refresh_token=');

    const projects = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${refresh.body.accessToken}`);

    expect(projects.status).toBe(200);
    expect(projects.body).toEqual({ ok: true, projects: [] });
  });

  it('rejects wrong password', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
  });

  it('does not expose registration or password management in MVP', async () => {
    const app = makeApp();

    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'new-user', password: 'secret123' });
    expect(register.status).toBe(404);

    const password = await request(app)
      .put('/api/auth/password')
      .send({ oldPassword: 'admin123', newPassword: 'secret123' });
    expect(password.status).toBe(404);
  });

  it('isolates initialized users by database path', () => {
    const oldUsername = process.env.DEFAULT_USERNAME;
    const oldDisplayName = process.env.DEFAULT_DISPLAY_NAME;

    try {
      const storeA = initUsers(path.join(tmpDir, 'a', 'users.db'));
      process.env.DEFAULT_USERNAME = 'owner2';
      process.env.DEFAULT_DISPLAY_NAME = 'Owner 2';
      const storeB = initUsers(path.join(tmpDir, 'b', 'users.db'));

      expect(storeA.findByUsername('admin')).toBeTruthy();
      expect(storeA.findByUsername('owner2')).toBeNull();
      expect(storeB.findByUsername('owner2')).toBeTruthy();
      expect(storeB.findByUsername('admin')).toBeNull();
    } finally {
      if (oldUsername === undefined) delete process.env.DEFAULT_USERNAME;
      else process.env.DEFAULT_USERNAME = oldUsername;
      if (oldDisplayName === undefined) delete process.env.DEFAULT_DISPLAY_NAME;
      else process.env.DEFAULT_DISPLAY_NAME = oldDisplayName;
    }
  });

  it('migrates legacy password column to password_hash and role', () => {
    const dbPath = path.join(tmpDir, 'legacy', 'users.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    try {
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          display_name TEXT,
          created_at TEXT NOT NULL
        );
      `);
      db.prepare("INSERT INTO users (id, username, password, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(
        'legacy-u1',
        'legacy',
        bcrypt.hashSync('legacy123', 10),
        '旧用户',
        '2026-07-07T00:00:00.000Z'
      );
    } finally {
      db.close();
    }

    const store = initUsers(dbPath);
    const user = store.findByUsername('legacy');

    expect(user).toMatchObject({
      id: 'legacy-u1',
      username: 'legacy',
      role: 'owner',
      display_name: '旧用户'
    });
    expect(store.verifyPassword(user, 'legacy123')).toBe(true);

    const migrated = new Database(dbPath);
    try {
      const columns = migrated.prepare('PRAGMA table_info(users)').all().map((column: { name: string }) => column.name);
      expect(columns).toContain('password_hash');
      expect(columns).toContain('role');
      const row = migrated.prepare('SELECT password_hash, role FROM users WHERE username = ?').get('legacy') as { password_hash: string; role: string };
      expect(row.password_hash).toBeTruthy();
      expect(row.role).toBe('owner');
    } finally {
      migrated.close();
    }
  });
});
