import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createRoutes } from '@/routes';
import { errorMiddleware } from '@/errors';

let tmpDir: string;

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'requirements-board-access-secret-dev';

function makeToken(userId = 'u1', username = 'test-admin') {
  return jwt.sign({ sub: userId, username, type: 'access' }, ACCESS_SECRET, { expiresIn: '15m' });
}

function authReq(base: request.Test, token = makeToken()) {
  return base.set('Authorization', `Bearer ${token}`);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', createRoutes(tmpDir));
  app.use(errorMiddleware());
  return app;
}

function seedDeepSeekAccount() {
  const accountsPath = path.join(tmpDir, 'data', 'ai-usage', 'accounts.json');
  fs.mkdirSync(path.dirname(accountsPath), { recursive: true });
  fs.writeFileSync(
    accountsPath,
    JSON.stringify(
      [
        {
          id: 'deepseek-balance',
          provider: 'deepseek',
          accountName: 'DeepSeek 余额',
          accountType: 'balance',
          dataSource: 'api',
          baseUrl: 'https://api.deepseek.com/v1',
          modelId: '',
          extraHeadersJson: '',
          quotaUnit: 'CNY',
          warningThreshold: 50,
          enabled: true,
          notes: '',
          apiKey: 'sk-test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      null,
      2
    )
  );
}

function makeStreamChunks() {
  // 构造 OpenAI 兼容 SSE 字节流
  const chunks = [
    'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"，"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n',
    'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}}\n\n',
    'data: [DONE]\n\n'
  ].join('');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(chunks));
      controller.close();
    }
  });
  return stream;
}

describe('AI 对话路由（Sprint 2）', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-routes-test-'));
    seedDeepSeekAccount();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/ai/providers 返回 deepseek', async () => {
    const res = await authReq(request(makeApp()).get('/api/ai/providers'));
    expect(res.status).toBe(200);
    expect(res.body.providers).toContain('deepseek');
  });

  it('GET /api/ai/accounts 列出已配置账号（脱敏）', async () => {
    const res = await authReq(request(makeApp()).get('/api/ai/accounts'));
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].id).toBe('deepseek-balance');
    expect(res.body.accounts[0].hasApiKey).toBe(true);
    expect(res.body.accounts[0]).not.toHaveProperty('apiKey');
  });

  it('未鉴权请求被拒', async () => {
    const res = await request(makeApp()).get('/api/ai/accounts');
    expect(res.status).toBe(401);
  });

  it('POST 流式：SSE 事件序列正确', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: makeStreamChunks()
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    // 建会话
    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    expect(create.status).toBe(200);
    const convId = create.body.conversation.id;

    // 发起流式消息
    const stream = await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages/stream?project=default`)
        .send({ text: '你好' })
    );

    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toContain('text/event-stream');

    const body = stream.text;
    expect(body).toContain('event: user');
    expect(body).toContain('event: start');
    expect(body).toContain('event: delta');
    expect(body).toContain('event: usage');
    expect(body).toContain('event: done');
    expect(body).toContain('你好，世界');

    // 验证消息落库
    const read = await authReq(
      request(makeApp()).get(`/api/ai/conversations/${convId}?project=default`)
    );
    expect(read.body.messages).toHaveLength(2);
    expect(read.body.messages[0]).toMatchObject({ role: 'user', content: '你好' });
    expect(read.body.messages[1]).toMatchObject({ role: 'assistant', content: '你好，世界' });
    expect(read.body.messages[1].tokensIn).toBe(3);
    expect(read.body.messages[1].tokensOut).toBe(4);
  });

  it('POST 流式：provider 报错时 SSE error 事件', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'bad key' } })
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;

    const stream = await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages/stream?project=default`)
        .send({ text: 'hi' })
    );

    expect(stream.status).toBe(200);
    expect(stream.text).toContain('event: error');
    expect(stream.text).toContain('bad key');
  });

  it('POST 同步：返回完整 assistant 消息', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: '同步答复' } }],
          usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 }
        })
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;

    const res = await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages?project=default`)
        .send({ text: 'hi' })
    );
    expect(res.status).toBe(200);
    expect(res.body.assistantMessage.content).toBe('同步答复');
    expect(res.body.usage.totalTokens).toBe(6);
  });

  it('流式：忽略客户端 Key 头并使用服务器账号 key', async () => {
    let capturedAuth: string | undefined;
    const fetchMock = vi.fn(async (_url: unknown, init: { headers: Record<string, string> }) => {
      capturedAuth = init.headers.Authorization;
      const chunks = [
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n',
        'data: [DONE]\n\n'
      ].join('');
      return {
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(chunks));
            controller.close();
          }
        })
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;

    await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages/stream?project=default`)
        .set('X-AI-Api-Key', 'sk-user-override')
        .send({ text: 'hi' })
    );

    expect(capturedAuth).toBe('Bearer sk-test');
  });

  it('PATCH /api/ai/conversations/:id 改名（含重名校验）', async () => {
    const c1 = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const c2 = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );

    // 改 c1 标题
    const rename = await authReq(
      request(makeApp())
        .patch(`/api/ai/conversations/${c1.body.conversation.id}?project=default`)
        .send({ title: '我自己的会话' })
    );
    expect(rename.status).toBe(200);
    expect(rename.body.conversation.title).toBe('我自己的会话');

    // c2 想改成同名 -> 409
    const dup = await authReq(
      request(makeApp())
        .patch(`/api/ai/conversations/${c2.body.conversation.id}?project=default`)
        .send({ title: '我自己的会话' })
    );
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('AI_TITLE_DUPLICATE');

    // 空标题 -> 400
    const empty = await authReq(
      request(makeApp())
        .patch(`/api/ai/conversations/${c2.body.conversation.id}?project=default`)
        .send({ title: '   ' })
    );
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('AI_TITLE_EMPTY');
  });

  it('AI 会话按当前用户隔离访问和改名校验', async () => {
    const previousToken = process.env.REQUIREMENTS_API_TOKEN;
    process.env.REQUIREMENTS_API_TOKEN = 'test-api-token';
    try {
      const app = makeApp();
      const ownerCreate = await authReq(
        request(app).post('/api/ai/conversations?project=default').send({ title: '同名会话' })
      );
      expect(ownerCreate.status).toBe(200);
      const ownerConvId = ownerCreate.body.conversation.id;

      const apiRequest = (base: request.Test) =>
        base.set('Authorization', 'Bearer test-api-token');

      const apiList = await apiRequest(request(app).get('/api/ai/conversations?project=default'));
      expect(apiList.status).toBe(200);
      expect(apiList.body.conversations).toEqual([]);

      const apiRead = await apiRequest(
        request(app).get(`/api/ai/conversations/${ownerConvId}?project=default`)
      );
      expect(apiRead.status).toBe(404);
      expect(apiRead.body.code).toBe('AI_CONVERSATION_NOT_FOUND');

      const apiRename = await apiRequest(
        request(app)
          .patch(`/api/ai/conversations/${ownerConvId}?project=default`)
          .send({ title: '不能改别人的' })
      );
      expect(apiRename.status).toBe(404);

      const apiMessage = await apiRequest(
        request(app)
          .post(`/api/ai/conversations/${ownerConvId}/messages?project=default`)
          .send({ text: 'hi' })
      );
      expect(apiMessage.status).toBe(404);

      const apiDelete = await apiRequest(
        request(app).delete(`/api/ai/conversations/${ownerConvId}?project=default`)
      );
      expect(apiDelete.status).toBe(404);

      const apiCreate = await apiRequest(
        request(app).post('/api/ai/conversations?project=default').send({})
      );
      expect(apiCreate.status).toBe(200);

      const apiSameTitle = await apiRequest(
        request(app)
          .patch(`/api/ai/conversations/${apiCreate.body.conversation.id}?project=default`)
          .send({ title: '同名会话' })
      );
      expect(apiSameTitle.status).toBe(200);
      expect(apiSameTitle.body.conversation.title).toBe('同名会话');

      const ownerRead = await authReq(
        request(app).get(`/api/ai/conversations/${ownerConvId}?project=default`)
      );
      expect(ownerRead.status).toBe(200);
      expect(ownerRead.body.conversation.title).toBe('同名会话');
    } finally {
      if (previousToken === undefined) delete process.env.REQUIREMENTS_API_TOKEN;
      else process.env.REQUIREMENTS_API_TOKEN = previousToken;
    }
  });

  it('DELETE /api/ai/conversations/:id 级联删除', async () => {
    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const cid = create.body.conversation.id;

    // 发一条消息让它有内容
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' +
                'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n' +
                'data: [DONE]\n\n'
            )
          );
          controller.close();
        }
      })
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${cid}/messages/stream?project=default`)
        .send({ text: 'hi' })
    );

    // 删除
    const del = await authReq(
      request(makeApp()).delete(`/api/ai/conversations/${cid}?project=default`)
    );
    expect(del.status).toBe(200);
    expect(del.body.conversations).toBe(1);
    expect(del.body.messages).toBeGreaterThanOrEqual(2); // user + assistant

    // 列表里没了
    const list = await authReq(
      request(makeApp()).get('/api/ai/conversations?project=default')
    );
    expect(list.body.conversations.find((c: { id: string }) => c.id === cid)).toBeUndefined();
  });
});
