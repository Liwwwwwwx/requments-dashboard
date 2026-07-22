import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Client } from 'pg';
import { createRoutes } from '../src/routes';
import { errorMiddleware } from '../src/errors';
import { getPool } from '../src/postgres';
import * as aiStore from '../src/ai/store';

const TABLES = [
  'login_attempts', 'refresh_tokens', 'ai_proposals', 'ai_messages',
  'ai_conversations', 'ai_accounts', 'events', 'project_members', 'projects', 'users'
].join(', ');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(cookieParser());
  instance.use('/api', createRoutes(process.cwd()));
  instance.use(errorMiddleware());
  return instance;
}

beforeEach(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
  await client.end();
});

afterAll(async () => {
  await getPool().end();
});

describe('PostgreSQL runtime', () => {
  it('注册、登录、项目、需求与备注均写入 PostgreSQL', async () => {
    const instance = app();
    const registration = await request(instance)
      .post('/api/auth/register')
      .send({ username: 'tester', password: 'password123' });
    expect(registration.status).toBe(201);
    const token = registration.body.accessToken;
    const auth = { Authorization: `Bearer ${token}` };

    const project = await request(instance)
      .post('/api/projects')
      .set(auth)
      .send({ id: 'alpha', name: 'Alpha' });
    expect(project.status).toBe(201);

    const requirement = await request(instance)
      .post('/api/projects/alpha/requirements')
      .set(auth)
      .send({ title: '迁移需求' });
    expect(requirement.status).toBe(201);
    const requirementId = requirement.body.requirement.id;

    const note = await request(instance)
      .post(`/api/projects/alpha/requirements/${requirementId}/events`)
      .set(auth)
      .send({ kind: 'note.add', text: '已落库' });
    expect(note.status).toBe(201);

    const history = await request(instance)
      .get(`/api/projects/alpha/requirements/${requirementId}/events`)
      .set(auth);
    expect(history.status).toBe(200);
    expect(history.body.events.map((event: { kind: string }) => event.kind)).toEqual(['req.new', 'note.add']);
  });

  it('AI 会话与消息使用 PostgreSQL', async () => {
    const instance = app();
    const registration = await request(instance)
      .post('/api/auth/register')
      .send({ username: 'aiuser', password: 'password123' });
    const token = registration.body.accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    await request(instance).post('/api/projects').set(auth).send({ id: 'alpha', name: 'Alpha' });

    const conversation = await aiStore.createConversation(process.cwd(), 'alpha', {
      userId: registration.body.user.id,
      model: 'deepseek-chat'
    });
    const message = await aiStore.appendMessage(process.cwd(), 'alpha', {
      conversationId: conversation.id,
      role: 'user',
      content: '你好'
    });
    const updated = await aiStore.updateMessageContent(process.cwd(), 'alpha', message.id, { content: '你好，世界' });
    expect(updated?.content).toBe('你好，世界');
    expect(await aiStore.listMessages(process.cwd(), 'alpha', conversation.id)).toHaveLength(1);
  });
});
