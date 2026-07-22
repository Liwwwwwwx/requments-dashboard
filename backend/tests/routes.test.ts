import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createRoutes } from '../src/routes';
import { errorMiddleware } from '../src/errors';
import { appendEvents, readEvents } from '../src/events';
import { projectPaths } from '../src/projects';

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

async function createProject(app: express.Express, id: string) {
  return authReq(
    request(app)
      .post('/api/projects')
      .send({ id, name: id })
  );
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-routes-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('requirements-board-backend');
  });
});

describe('GET /api/projects', () => {
  it('returns empty list when no projects', async () => {
    const res = await authReq(request(makeApp()).get('/api/projects'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, projects: [] });
  });

  it('accepts the configured long-lived API token', async () => {
    const previous = process.env.REQUIREMENTS_API_TOKEN;
    process.env.REQUIREMENTS_API_TOKEN = 'test-long-lived-token';
    try {
      const res = await request(makeApp())
        .get('/api/projects')
        .set('Authorization', 'Bearer test-long-lived-token');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, projects: [] });
    } finally {
      if (previous === undefined) delete process.env.REQUIREMENTS_API_TOKEN;
      else process.env.REQUIREMENTS_API_TOKEN = previous;
    }
  });

  it('rejects an invalid API token', async () => {
    const previous = process.env.REQUIREMENTS_API_TOKEN;
    process.env.REQUIREMENTS_API_TOKEN = 'test-long-lived-token';
    try {
      const res = await request(makeApp())
        .get('/api/projects')
        .set('Authorization', 'Bearer wrong-token');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    } finally {
      if (previous === undefined) delete process.env.REQUIREMENTS_API_TOKEN;
      else process.env.REQUIREMENTS_API_TOKEN = previous;
    }
  });

  it('returns existing projects', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'alpha'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'data', 'beta'), { recursive: true });
    const res = await authReq(request(makeApp()).get('/api/projects'));
    expect(res.body.projects.map((p: { id: string }) => p.id)).toEqual(['alpha', 'beta']);
  });
});

describe('MVP API boundary', () => {
  it('does not expose dashboard summary endpoints', async () => {
    const res = await authReq(request(makeApp()).get('/api/dashboard/summary'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects', () => {
  it('creates a project with valid id', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'newproj' })
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.project.id).toBe('newproj');
    expect(fs.existsSync(path.join(tmpDir, 'data', 'newproj'))).toBe(true);
  });

  it('returns an empty requirement list for a newly created project', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'emptyproj' })
    );

    const res = await authReq(request(makeApp()).get('/api/projects/emptyproj/requirements'));

    expect(res.status).toBe(200);
    expect(res.body.requirements).toEqual([]);
  });

  it('rejects duplicate project creation without updating metadata', async () => {
    const app = makeApp();
    const first = await authReq(
      request(app)
        .post('/api/projects')
        .send({ id: 'alpha', name: 'Alpha 项目', description: '第一版' })
    );
    expect(first.status).toBe(200);

    const duplicate = await authReq(
      request(app)
        .post('/api/projects')
        .send({ id: 'alpha', name: '覆盖名称', description: '不应写入' })
    );

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('PROJECT_ALREADY_EXISTS');

    const detail = await authReq(request(app).get('/api/projects/alpha'));
    expect(detail.body.project).toMatchObject({
      id: 'alpha',
      name: 'Alpha 项目',
      description: '第一版'
    });
  });

  it('rejects invalid id with structured error', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'bad id with space' })
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      code: 'INVALID_PROJECT_ID'
    });
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects missing id with structured error', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({})
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PROJECT_ID');
  });
});

describe('Project detail APIs', () => {
  it('rejects invalid project id in parameterized APIs', async () => {
    const detail = await authReq(request(makeApp()).get('/api/projects/bad%20id'));
    expect(detail.status).toBe(400);
    expect(detail.body.code).toBe('INVALID_PROJECT_ID');

    const update = await authReq(
      request(makeApp())
        .patch('/api/projects/bad%20id')
        .send({ name: 'Bad' })
    );
    expect(update.status).toBe(400);
    expect(update.body.code).toBe('INVALID_PROJECT_ID');
  });

  it('returns project detail with metadata', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'alpha', name: 'Alpha 项目', description: '第一阶段需求' })
    );

    const res = await authReq(request(makeApp()).get('/api/projects/alpha'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      project: {
        id: 'alpha',
        name: 'Alpha 项目',
        description: '第一阶段需求'
      }
    });
    expect(typeof res.body.project.createdAt).toBe('string');
    expect(typeof res.body.project.updatedAt).toBe('string');
  });

  it('updates project name and description', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'alpha' })
    );

    const res = await authReq(
      request(makeApp())
        .patch('/api/projects/alpha')
        .send({ name: 'Alpha 新名称', description: '更新后的说明' })
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      project: {
        id: 'alpha',
        name: 'Alpha 新名称',
        description: '更新后的说明'
      }
    });

    const list = await authReq(request(makeApp()).get('/api/projects'));
    expect(list.body.projects[0]).toMatchObject({
      id: 'alpha',
      name: 'Alpha 新名称',
      description: '更新后的说明'
    });
  });

  it('rejects empty project name updates', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'alpha', name: 'Alpha 项目' })
    );

    const res = await authReq(
      request(makeApp())
        .patch('/api/projects/alpha')
        .send({ name: '   ' })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_PROJECT_NAME');
  });

  it('returns 404 when project detail is missing', async () => {
    const res = await authReq(request(makeApp()).get('/api/projects/missing'));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('GET /api/projects/:project/state', () => {
  it('does not expose the legacy state endpoint in V2', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'p1'), { recursive: true });
    const paths = projectPaths(tmpDir, 'p1');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's'
      }
    ]);

    const res = await authReq(request(makeApp()).get('/api/projects/p1/state'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/:project/events', () => {
  it('does not expose the project-level event write endpoint in V2', async () => {
    const app = makeApp();
    await createProject(app, 'p1');

    const res = await authReq(
      request(app)
        .post('/api/projects/p1/events')
        .send({
          events: [
            {
              kind: 'req.new',
              requirementId: 'REQ-0001',
              title: '旧入口创建需求'
            }
          ]
        })
    );

    expect(res.status).toBe(404);
  });
});

describe('V2 requirement REST APIs', () => {
  it('rejects malformed requirement id in parameterized APIs', async () => {
    const res = await authReq(request(makeApp()).get('/api/projects/v2/requirements/BAD-001'));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_REQUIREMENT_ID');
  });

  it('lists requirements for a project', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录',
        summary: '用户登录',
        priority: 'P1'
      }
    ]);

    const res = await authReq(request(makeApp()).get('/api/projects/v2/requirements'));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.project).toBe('v2');
    expect(res.body.requirements).toHaveLength(1);
    expect(res.body.requirements[0]).toMatchObject({
      id: 'REQ-0001',
      title: '登录',
      status: 'todo'
    });
  });

  it('renders requirements from the event database when state cache is stale', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '数据库事实源',
        summary: '不要信旧缓存',
        priority: 'P1'
      }
    ]);
    fs.writeFileSync(
      paths.stateJsonPath,
      `${JSON.stringify({ updatedAt: 'stale', statuses: [], items: [] }, null, 2)}\n`
    );

    const res = await authReq(request(makeApp()).get('/api/projects/v2/requirements'));

    expect(res.status).toBe(200);
    expect(res.body.requirements).toHaveLength(1);
    expect(res.body.requirements[0]).toMatchObject({
      id: 'REQ-0001',
      title: '数据库事实源'
    });

    const refreshed = JSON.parse(fs.readFileSync(paths.stateJsonPath, 'utf8'));
    expect(refreshed.items).toHaveLength(1);
    expect(refreshed.items[0].title).toBe('数据库事实源');
  });

  it('returns a requirement detail through the V2 REST API', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录',
        summary: '用户登录',
        priority: 'P1',
        owner: 'pm'
      }
    ]);

    const res = await authReq(request(makeApp()).get('/api/projects/v2/requirements/REQ-0001'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      project: 'v2',
      requirement: {
        id: 'REQ-0001',
        title: '登录',
        summary: '用户登录',
        priority: 'P1',
        owner: 'pm',
        status: 'todo'
      }
    });
  });

  it('returns 404 when requirement detail is missing', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(request(makeApp()).get('/api/projects/v2/requirements/REQ-9999'));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REQUIREMENT_NOT_FOUND');
  });

  it('creates a requirement through the V2 REST API', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'v2', name: 'V2 项目' })
    );

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements')
        .send({
          title: '需求看板',
          description: '按项目查看需求',
          goal: '用看板按状态推进需求，并保留每次调整的审计记录',
          next: '先补新建需求弹窗',
          priority: 'P0',
          owner: 'pm'
        })
    );

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.requirement).toMatchObject({
      id: 'REQ-0001',
      title: '需求看板',
      summary: '按项目查看需求',
      priority: 'P0',
      owner: 'pm',
      createdBy: 'admin',
      status: 'todo',
      detail: {
        goal: '用看板按状态推进需求，并保留每次调整的审计记录',
        next: '先补新建需求弹窗'
      }
    });
    expect(res.body.event.kind).toBe('req.new');
  });

  it('rejects requirement creation when project is missing', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects/missing/requirements')
        .send({ title: '需求看板' })
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });

  it('rejects invalid priority when creating a requirement', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'v2', name: 'V2 项目' })
    );

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements')
        .send({
          title: '需求看板',
          priority: 'P9'
        })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PRIORITY');
  });

  it('rejects invalid status when creating a requirement', async () => {
    await authReq(
      request(makeApp())
        .post('/api/projects')
        .send({ id: 'v2', name: 'V2 项目' })
    );

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements')
        .send({
          title: '需求看板',
          status: 'reviewing'
        })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS');
  });

  it('patches requirement fields and status through the V2 REST API', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '旧标题',
        summary: '旧描述',
        priority: 'P2'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .patch('/api/projects/v2/requirements/REQ-0001')
        .send({
          title: '新标题',
          description: '新描述',
          goal: '登录流程、失败提示与状态恢复方案',
          next: '确认登录失败提示',
          acceptance: ['登录成功后进入项目页', '密码错误时显示提示'],
          status: 'blocked',
          priority: 'P1',
          owner: 'dev'
        })
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.requirement).toMatchObject({
      id: 'REQ-0001',
      title: '新标题',
      summary: '新描述',
      status: 'blocked',
      priority: 'P1',
      owner: 'dev',
      detail: {
        goal: '登录流程、失败提示与状态恢复方案',
        next: '确认登录失败提示'
      },
      acceptance: ['登录成功后进入项目页', '密码错误时显示提示']
    });
    expect(res.body.appended).toBe(2);
    const patchEvent = readEvents(paths.eventsPath).find((event) => event.kind === 'req.patch');
    expect(patchEvent).toMatchObject({
      detail: {
        goal: '登录流程、失败提示与状态恢复方案',
        next: '确认登录失败提示'
      },
      acceptance: ['登录成功后进入项目页', '密码错误时显示提示']
    });
  });

  it('rejects invalid status and priority when patching a requirement', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '旧标题'
      }
    ]);

    const invalidStatus = await authReq(
      request(makeApp())
        .patch('/api/projects/v2/requirements/REQ-0001')
        .send({ status: 'reviewing' })
    );
    expect(invalidStatus.status).toBe(400);
    expect(invalidStatus.body.code).toBe('INVALID_STATUS');

    const invalidPriority = await authReq(
      request(makeApp())
        .patch('/api/projects/v2/requirements/REQ-0001')
        .send({ priority: 'P9' })
    );
    expect(invalidPriority.status).toBe(400);
    expect(invalidPriority.body.code).toBe('INVALID_PRIORITY');

    const emptyTitle = await authReq(
      request(makeApp())
        .patch('/api/projects/v2/requirements/REQ-0001')
        .send({ title: '   ' })
    );
    expect(emptyTitle.status).toBe(400);
    expect(emptyTitle.body.code).toBe('MISSING_TITLE');
  });

  it('rejects terminal requirement status rollback before appending events', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '已完成需求',
        status: 'done'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .patch('/api/projects/v2/requirements/REQ-0001')
        .send({ status: 'todo' })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    expect(readEvents(paths.eventsPath).map((event) => event.kind)).toEqual(['req.new']);
  });

  it('returns only V2 events for requirement history', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      },
      {
        kind: 'task.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        title: '旧任务'
      },
      {
        kind: 'contract.set',
        actor: 'test',
        requirementId: 'REQ-0001',
        endpoints: [{ method: 'GET', path: '/api/legacy' }]
      },
      {
        kind: 'note.add',
        actor: 'test',
        requirementId: 'REQ-0001',
        text: '保留最小登录'
      }
    ]);

    const res = await authReq(
      request(makeApp()).get('/api/projects/v2/requirements/REQ-0001/events')
    );

    expect(res.status).toBe(200);
    expect(res.body.events.map((event: { kind: string }) => event.kind)).toEqual([
      'req.new',
      'note.add'
    ]);
  });

  it('returns 404 when requirement history target is missing', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(
      request(makeApp()).get('/api/projects/v2/requirements/REQ-9999/events')
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REQUIREMENT_NOT_FOUND');
  });

  it('adds a requirement note through the requirement event API', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录',
        summary: '用户登录'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'note.add', text: '先保持最简单登录' })
    );

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.appended).toBe(1);
    expect(res.body.events[0]).toMatchObject({
      kind: 'note.add',
      requirementId: 'REQ-0001',
      text: '先保持最简单登录',
      actor: 'admin'
    });
    expect(res.body.requirement.notes).toHaveLength(1);
    expect(res.body.requirement.notes[0].text).toBe('先保持最简单登录');
  });

  it('rejects empty requirement notes', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'note.add', text: '   ' })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMPTY_NOTE');
  });

  it('rejects requirement event id mismatch', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'note.add', requirementId: 'REQ-0002', text: 'wrong' })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REQUIREMENT_EVENT_MISMATCH');
  });

  it('rejects legacy event kinds on the requirement-scoped event API', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({
          kind: 'task.new',
          taskId: 'FE-1',
          title: '旧任务'
        })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_REQUIREMENT_EVENT_KIND');
  });

  it('rejects terminal rollback on the requirement-scoped event API before appending', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '已完成需求',
        status: 'done'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'req.status', status: 'todo' })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    expect(readEvents(paths.eventsPath).map((event) => event.kind)).toEqual(['req.new']);
  });

  it('validates requirement-scoped status and priority events', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const missingStatus = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'req.status' })
    );
    expect(missingStatus.status).toBe(400);
    expect(missingStatus.body.code).toBe('MISSING_STATUS');

    const invalidStatus = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'req.status', status: 'reviewing' })
    );
    expect(invalidStatus.status).toBe(400);
    expect(invalidStatus.body.code).toBe('INVALID_STATUS');

    const invalidPriority = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'req.patch', priority: 'P9' })
    );
    expect(invalidPriority.status).toBe(400);
    expect(invalidPriority.body.code).toBe('INVALID_PRIORITY');

    const emptyTitle = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({ kind: 'req.patch', title: '   ' })
    );
    expect(emptyTitle.status).toBe(400);
    expect(emptyTitle.body.code).toBe('MISSING_TITLE');
  });

  it('rejects invalid requirement acceptance structures on requirement-scoped events', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({
          kind: 'req.patch',
          acceptance: ['登录成功后进入项目页', { text: '非法验收点' }]
        })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ACCEPTANCE');
    expect(readEvents(paths.eventsPath).map((event) => event.kind)).toEqual(['req.new']);
  });

  it('rejects legacy requirement detail fields on requirement-scoped events', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'v2'), { recursive: true });
    const paths = projectPaths(tmpDir, 'v2');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: '登录'
      }
    ]);

    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements/REQ-0001/events')
        .send({
          kind: 'req.patch',
          detail: {
            goal: '补齐登录体验',
            nonGoals: ['注册']
          }
        })
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DETAIL');
    expect(readEvents(paths.eventsPath).map((event) => event.kind)).toEqual(['req.new']);
  });
});

describe('GET /api/projects/:project/events', () => {
  it('does not expose the project-level events list in V2', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'pe'), { recursive: true });
    const paths = projectPaths(tmpDir, 'pe');
    appendEvents(paths.eventsPath, [
      { eventId: 'E1', ts: 1000, kind: 'req.new', actor: 'alice', requirementId: 'REQ-0001', title: 'A', summary: 'sa' },
      { eventId: 'E2', ts: 2000, kind: 'note.add', actor: 'alice', requirementId: 'REQ-0001', text: '备注' }
    ]);

    const res = await authReq(request(makeApp()).get('/api/projects/pe/events'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/:project/render', () => {
  it('does not expose the legacy render endpoint in V2', async () => {
    fs.mkdirSync(path.join(tmpDir, 'data', 'p4'), { recursive: true });
    const paths = projectPaths(tmpDir, 'p4');
    appendEvents(paths.eventsPath, [
      {
        kind: 'req.new',
        actor: 'test',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's'
      }
    ]);
    const res = await authReq(request(makeApp()).post('/api/projects/p4/render').send({}));
    expect(res.status).toBe(404);
  });
});
