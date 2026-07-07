import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createRoutes } from '../src/routes';
import { errorMiddleware } from '../src/errors';
import { appendEvents } from '../src/events';
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
      expect(res.body).toEqual({ ok: false, error: 'UNAUTHORIZED' });
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

describe('GET /api/projects/:project/state', () => {
  it('returns 404 with structured error when project missing', async () => {
    const res = await authReq(request(makeApp()).get('/api/projects/missing/state'));
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      ok: false,
      code: 'PROJECT_NOT_FOUND'
    });
  });

  it('renders and returns state.json for valid project', async () => {
    // bootstrap project + a req.new event via the proper API
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
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('REQ-0001');
  });
});

describe('POST /api/projects/:project/events', () => {
  it('rejects empty events list with structured error', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects/p1/events')
        .send({ events: [] })
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      code: 'EMPTY_EVENTS'
    });
  });

  it('appends valid event and returns updated state', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects/p2/events')
        .send({
          events: [
            {
              kind: 'req.new',
              requirementId: 'REQ-0001',
              title: 't',
              summary: 's'
            }
          ]
        })
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.appended).toBe(1);
    expect(res.body.items).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'data', 'p2', 'events.db'))).toBe(true);
  });

  it('rejects invalid event with structured error', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects/p3/events')
        .send({
          events: [{ kind: 'req.new' /* missing requirementId */ }]
        })
    );
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(typeof res.body.message).toBe('string');
  });
});

describe('V2 requirement REST APIs', () => {
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

  it('creates a requirement through the V2 REST API', async () => {
    const res = await authReq(
      request(makeApp())
        .post('/api/projects/v2/requirements')
        .send({
          title: '需求看板',
          description: '按项目查看需求',
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
      status: 'todo'
    });
    expect(res.body.event.kind).toBe('req.new');
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
      owner: 'dev'
    });
    expect(res.body.appended).toBe(2);
  });
});

describe('GET /api/projects/:project/events', () => {
  function seedEvents() {
    fs.mkdirSync(path.join(tmpDir, 'data', 'pe'), { recursive: true });
    const paths = projectPaths(tmpDir, 'pe');
    appendEvents(paths.eventsPath, [
      { eventId: 'E1', ts: 1000, kind: 'req.new', actor: 'alice', requirementId: 'REQ-0001', title: 'A', summary: 'sa' },
      { eventId: 'E2', ts: 2000, kind: 'task.new', actor: 'bob', requirementId: 'REQ-0001', taskId: 'FE-1', role: 'frontend', title: 'fe task', status: 'todo' },
      { eventId: 'E3', ts: 3000, kind: 'task.status', actor: 'bob', requirementId: 'REQ-0001', taskId: 'FE-1', status: 'done' },
      { eventId: 'E4', ts: 4000, kind: 'req.new', actor: 'alice', requirementId: 'REQ-0002', title: 'B', summary: 'sb' }
    ]);
  }

  it('returns 404 when project missing', async () => {
    const res = await authReq(request(makeApp()).get('/api/projects/missing/events'));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });

  it('requires authentication', async () => {
    seedEvents();
    const res = await request(makeApp()).get('/api/projects/pe/events');
    expect(res.status).toBe(401);
  });

  it('returns events newest-first with total/hasMore', async () => {
    seedEvents();
    const res = await authReq(request(makeApp()).get('/api/projects/pe/events'));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.total).toBe(4);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.events.map((e: { eventId: string }) => e.eventId)).toEqual(['E4', 'E3', 'E2', 'E1']);
  });

  it('paginates with limit and offset', async () => {
    seedEvents();
    const page1 = await authReq(request(makeApp()).get('/api/projects/pe/events?limit=2&offset=0'));
    expect(page1.body.events.map((e: { eventId: string }) => e.eventId)).toEqual(['E4', 'E3']);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.total).toBe(4);

    const page2 = await authReq(request(makeApp()).get('/api/projects/pe/events?limit=2&offset=2'));
    expect(page2.body.events.map((e: { eventId: string }) => e.eventId)).toEqual(['E2', 'E1']);
    expect(page2.body.hasMore).toBe(false);
  });

  it('filters by kind', async () => {
    seedEvents();
    const res = await authReq(request(makeApp()).get('/api/projects/pe/events?kind=req.new'));
    expect(res.body.total).toBe(2);
    expect(res.body.events.map((e: { eventId: string }) => e.eventId)).toEqual(['E4', 'E1']);
  });

  it('filters by requirementId', async () => {
    seedEvents();
    const res = await authReq(request(makeApp()).get('/api/projects/pe/events?requirementId=REQ-0002'));
    expect(res.body.total).toBe(1);
    expect(res.body.events[0].eventId).toBe('E4');
    expect(res.body.events[0].kind).toBe('req.new');
  });
});

describe('POST /api/projects/:project/render', () => {
  it('returns 404 when project missing', async () => {
    const res = await authReq(request(makeApp()).post('/api/projects/missing/render').send({}));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });

  it('rebuilds state.json for an existing project', async () => {
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
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toBe(1);
  });
});
