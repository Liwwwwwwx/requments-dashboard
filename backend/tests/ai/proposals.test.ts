import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createRoutes } from '@/routes';
import { errorMiddleware } from '@/errors';
import { readEvents } from '@/events';
import { projectPaths } from '@/projects';
import aiStore from '@/ai/store';

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

function seedProject(project = 'default') {
  fs.mkdirSync(path.join(tmpDir, 'data', project), { recursive: true });
}

function makeStreamWithToolCall() {
  // 模型先流式输出文字，再发出需求级 tool_call
  // 整段 arguments 是一个合法 JSON，分多次片段发出，模拟真实流式
  const argsObject = {
    rationale: '推进需求状态',
    events: [
      {
        kind: 'req.status',
        requirementId: 'REQ-0001',
        status: 'doing'
      }
    ]
  };
  const fullArgs = JSON.stringify(argsObject);
  // 切分成几个片段
  const splitAt = Math.floor(fullArgs.length / 3);
  const parts = [
    fullArgs.slice(0, splitAt),
    fullArgs.slice(splitAt, splitAt * 2),
    fullArgs.slice(splitAt * 2)
  ];

  const encoder = new TextEncoder();
  const lines = [
    'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"的"}}]}\n\n',
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"propose_events"}}]}}]}\n\n`,
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":${JSON.stringify(parts[0])}}}]}}]}\n\n`,
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":${JSON.stringify(parts[1])}}}]}}]}\n\n`,
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":${JSON.stringify(parts[2])}}}]}}]}\n\n`,
    'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":20,"completion_tokens":30,"total_tokens":50}}\n\n',
    'data: [DONE]\n\n'
  ].join('');

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    }
  });
  return stream;
}

function makeStreamWithInvalidToolCall() {
  const argsObject = {
    rationale: '尝试创建旧版任务',
    events: [
      {
        kind: 'task.new',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        title: '旧版任务'
      }
    ]
  };
  const args = JSON.stringify(argsObject);
  const encoder = new TextEncoder();
  const lines = [
    'data: {"choices":[{"delta":{"content":"我先给出建议"}}]}\n\n',
    `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"propose_events","arguments":${JSON.stringify(args)}}}]}}]}\n\n`,
    'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":20,"completion_tokens":30,"total_tokens":50}}\n\n',
    'data: [DONE]\n\n'
  ].join('');

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    }
  });
}

describe('AI 对话 Sprint 3（工具调用 + 提案应用）', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-sprint3-test-'));
    seedDeepSeekAccount();
    seedProject();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('流式：模型返回 tool_calls 时写入 ai_proposals 并发送 event: proposal', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: makeStreamWithToolCall()
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;

    const stream = await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages/stream?project=default`)
        .send({ text: '帮我推进 REQ-0001 的状态' })
    );

    expect(stream.status).toBe(200);
    const body = stream.text;
    expect(body).toContain('event: proposal');
    expect(body).toContain('"proposalId"');
    expect(body).toContain('"events"');
    expect(body).toContain('req.status');
    expect(body).toContain('doing');

    // 提取 proposalId（不依赖严格 JSON 解析，做简单字符串匹配）
    const match = body.match(/"proposalId":"([^"]+)"/);
    expect(match).not.toBeNull();
    const proposalId = match![1];

    // list 接口能列出这个 proposal
    const list = await authReq(
      request(makeApp()).get(`/api/ai/conversations/${convId}/proposals?project=default`)
    );
    expect(list.body.proposals).toHaveLength(1);
    expect(list.body.proposals[0].id).toBe(proposalId);
    expect(list.body.proposals[0].status).toBe('pending');
  });

  it('流式：模型返回非法 tool_calls 时不写入 ai_proposals', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: makeStreamWithInvalidToolCall()
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;

    const stream = await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages/stream?project=default`)
        .send({ text: '帮我创建旧版任务' })
    );

    expect(stream.status).toBe(200);
    expect(stream.text).toContain('event: error');
    expect(stream.text).toContain('AI_PROPOSAL_INVALID');
    expect(stream.text).not.toContain('event: proposal');
    expect(stream.text).not.toContain('"proposalId"');

    const list = await authReq(
      request(makeApp()).get(`/api/ai/conversations/${convId}/proposals?project=default`)
    );
    expect(list.body.proposals).toEqual([]);
  });

  it('apply 提案：需求级事件写入 events.db，state.json 重新生成', async () => {
    // 先建一个 req.new 事件让 REQ-0001 存在
    const newReq = await authReq(
      request(makeApp()).post('/api/projects/default/events?project=default').send({
        events: [
          {
            kind: 'req.new',
            actor: 'test',
            requirementId: 'REQ-0001',
            title: '测试需求',
            summary: '用于 Sprint 3 集成测试',
            priority: 'P1'
          }
        ]
      })
    );
    expect(newReq.status).toBe(200);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: makeStreamWithToolCall()
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;

    const stream = await authReq(
      request(makeApp())
        .post(`/api/ai/conversations/${convId}/messages/stream?project=default`)
        .send({ text: '帮我推进状态' })
    );
    const match = stream.text.match(/"proposalId":"([^"]+)"/);
    const proposalId = match![1];

    // 应用提案
    const apply = await authReq(
      request(makeApp())
        .post(`/api/ai/proposals/${proposalId}/apply?project=default`)
        .send({})
    );
    expect(apply.status).toBe(200);
    expect(apply.body.applied).toBe(1);

    // 验证 events.db 里有 req.status
    const paths = projectPaths(tmpDir, 'default');
    const events = readEvents(paths.eventsPath);
    const statusEvents = events.filter((e) => e.kind === 'req.status' && e.requirementId === 'REQ-0001');
    expect(statusEvents.length).toBe(1);
    expect(statusEvents[0].status).toBe('doing');
    expect(statusEvents[0].actor).toMatch(/^ai:/);

    // 验证 state.json 已重新生成
    expect(fs.existsSync(paths.stateJsonPath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(paths.stateJsonPath, 'utf8'));
    const reqItem = state.items.find((i: { id: string }) => i.id === 'REQ-0001');
    expect(reqItem).toBeDefined();
    expect(reqItem.status).toBe('doing');

    // 二次 apply 应该返回 409（已 applied）
    const apply2 = await authReq(
      request(makeApp())
        .post(`/api/ai/proposals/${proposalId}/apply?project=default`)
        .send({})
    );
    expect(apply2.status).toBe(409);
  });

  it('apply 提案：拒绝不符合 V2 范围的脏提案', async () => {
    const newReq = await authReq(
      request(makeApp()).post('/api/projects/default/events?project=default').send({
        events: [
          {
            kind: 'req.new',
            actor: 'test',
            requirementId: 'REQ-0001',
            title: '测试需求'
          }
        ]
      })
    );
    expect(newReq.status).toBe(200);

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;
    const proposal = aiStore.createProposal(tmpDir, 'default', {
      conversationId: convId,
      messageId: 'MSG-test',
      events: [
        {
          kind: 'task.status',
          requirementId: 'REQ-0001',
          taskId: 'FE-1',
          status: 'working'
        }
      ]
    });

    const apply = await authReq(
      request(makeApp())
        .post(`/api/ai/proposals/${proposal.id}/apply?project=default`)
        .send({})
    );

    expect(apply.status).toBe(400);
    expect(apply.body.code).toBe('AI_PROPOSAL_INVALID');
    expect(readEvents(projectPaths(tmpDir, 'default').eventsPath).filter((e) => e.kind === 'task.status')).toHaveLength(0);
  });

  it('apply 提案：写入备注前会修剪文本空白', async () => {
    const newReq = await authReq(
      request(makeApp()).post('/api/projects/default/events?project=default').send({
        events: [
          {
            kind: 'req.new',
            actor: 'test',
            requirementId: 'REQ-0001',
            title: '测试需求'
          }
        ]
      })
    );
    expect(newReq.status).toBe(200);

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;
    const proposal = aiStore.createProposal(tmpDir, 'default', {
      conversationId: convId,
      messageId: 'MSG-test',
      events: [
        {
          kind: 'note.add',
          requirementId: 'REQ-0001',
          text: '  先补登录错误提示  '
        }
      ]
    });

    const apply = await authReq(
      request(makeApp())
        .post(`/api/ai/proposals/${proposal.id}/apply?project=default`)
        .send({})
    );

    expect(apply.status).toBe(200);
    const notes = readEvents(projectPaths(tmpDir, 'default').eventsPath).filter((e) => e.kind === 'note.add');
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('先补登录错误提示');
  });

  it('apply 提案：拒绝指向不存在需求的事件', async () => {
    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;
    const proposal = aiStore.createProposal(tmpDir, 'default', {
      conversationId: convId,
      messageId: 'MSG-test',
      events: [
        {
          kind: 'req.status',
          requirementId: 'REQ-9999',
          status: 'doing'
        }
      ]
    });

    const apply = await authReq(
      request(makeApp())
        .post(`/api/ai/proposals/${proposal.id}/apply?project=default`)
        .send({})
    );

    expect(apply.status).toBe(404);
    expect(apply.body.code).toBe('AI_PROPOSAL_REQUIREMENT_NOT_FOUND');
  });

  it('apply 提案：拒绝终态需求状态回退且不写入事件', async () => {
    const newReq = await authReq(
      request(makeApp()).post('/api/projects/default/events?project=default').send({
        events: [
          {
            kind: 'req.new',
            actor: 'test',
            requirementId: 'REQ-0001',
            title: '已完成需求',
            status: 'done'
          }
        ]
      })
    );
    expect(newReq.status).toBe(200);

    const create = await authReq(
      request(makeApp()).post('/api/ai/conversations?project=default').send({})
    );
    const convId = create.body.conversation.id;
    const proposal = aiStore.createProposal(tmpDir, 'default', {
      conversationId: convId,
      messageId: 'MSG-test',
      events: [
        {
          kind: 'req.status',
          requirementId: 'REQ-0001',
          status: 'todo'
        }
      ]
    });

    const apply = await authReq(
      request(makeApp())
        .post(`/api/ai/proposals/${proposal.id}/apply?project=default`)
        .send({})
    );

    expect(apply.status).toBe(400);
    expect(apply.body.code).toBe('AI_PROPOSAL_STATUS_TRANSITION_INVALID');
    expect(readEvents(projectPaths(tmpDir, 'default').eventsPath).map((e) => e.kind)).toEqual(['req.new']);
  });
});
