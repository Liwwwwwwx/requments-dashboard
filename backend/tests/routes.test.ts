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