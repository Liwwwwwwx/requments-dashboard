import { describe, expect, it } from 'vitest';
import { BOARD_STATUSES, buildState } from '../src/state';

describe('buildState', () => {
  it('returns empty items for empty events', () => {
    const state = buildState([]);
    expect(state.items).toEqual([]);
    expect(state.statuses).toEqual(BOARD_STATUSES);
    expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('builds a requirement from req.new', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: '登录',
        summary: '用户登录',
        priority: 'P1',
        actor: 'a'
      }
    ];
    const state = buildState(events);
    expect(state.items).toHaveLength(1);
    const req = state.items[0];
    expect(req.id).toBe('REQ-0001');
    expect(req.title).toBe('登录');
    expect(req.priority).toBe('P1');
    expect(req.status).toBe('todo');
    expect(req.tasks).toEqual([]);
    expect(req.taskStats).toEqual({ total: 0, done: 0, active: 0, blocked: 0 });
    expect(req.contract).toEqual({ ready: false, endpoints: [] });
  });

  it('applies req.status updates', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's',
        actor: 'a'
      },
      {
        kind: 'req.status',
        requirementId: 'REQ-0001',
        status: 'doing',
        workflowStatus: 'frontend-working',
        actor: 'a'
      }
    ];
    const state = buildState(events);
    expect(state.items[0].status).toBe('doing');
    expect(state.items[0].workflowStatus).toBe('frontend-working');
  });

  it('applies req.patch (partial update)', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 'old',
        summary: 's',
        priority: 'P2',
        actor: 'a'
      },
      {
        kind: 'req.patch',
        requirementId: 'REQ-0001',
        title: 'new',
        priority: 'P0',
        actor: 'a'
      }
    ];
    const state = buildState(events);
    expect(state.items[0].title).toBe('new');
    expect(state.items[0].priority).toBe('P0');
  });

  it('appends tasks via task.new and updates via task.status', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's',
        actor: 'a'
      },
      {
        kind: 'task.new',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        role: 'frontend',
        title: '实现按钮',
        scope: '按钮交互',
        status: 'todo',
        actor: 'a'
      },
      {
        kind: 'task.new',
        requirementId: 'REQ-0001',
        taskId: 'QA-1',
        role: 'qa',
        title: '验收',
        status: 'todo',
        actor: 'a'
      },
      {
        kind: 'task.status',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        status: 'done',
        actor: 'a'
      },
      {
        kind: 'task.status',
        requirementId: 'REQ-0001',
        taskId: 'QA-1',
        status: 'blocked',
        actor: 'a'
      }
    ];
    const state = buildState(events);
    const req = state.items[0];
    expect(req.tasks).toHaveLength(2);
    // sorted by taskId: FE-1 then QA-1
    expect(req.tasks[0].taskId).toBe('FE-1');
    expect(req.tasks[1].taskId).toBe('QA-1');
    expect(req.taskStats).toEqual({ total: 2, done: 1, active: 0, blocked: 1 });
  });

  it('upserts task when task.new is replayed', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's',
        actor: 'a'
      },
      {
        kind: 'task.new',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        role: 'frontend',
        title: 'old title',
        status: 'todo',
        actor: 'a'
      },
      {
        kind: 'task.new',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        title: 'new title',
        scope: 'updated scope',
        actor: 'a'
      }
    ];
    const state = buildState(events);
    expect(state.items[0].tasks).toHaveLength(1);
    expect(state.items[0].tasks[0].title).toBe('new title');
    expect(state.items[0].tasks[0].scope).toBe('updated scope');
  });

  it('sets contract via contract.set', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's',
        actor: 'a'
      },
      {
        kind: 'contract.set',
        requirementId: 'REQ-0001',
        endpoints: [
          { method: 'POST', path: '/api/x' },
          { method: 'GET', path: '/api/x/:id' }
        ],
        actor: 'a'
      }
    ];
    const state = buildState(events);
    const req = state.items[0];
    expect(req.contract.ready).toBe(true);
    expect(req.contract.endpoints).toHaveLength(2);
  });

  it('marks contract as not ready when endpoints is empty', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's',
        actor: 'a'
      },
      {
        kind: 'contract.set',
        requirementId: 'REQ-0001',
        endpoints: [],
        actor: 'a'
      }
    ];
    const state = buildState(events);
    expect(state.items[0].contract.ready).toBe(false);
  });

  it('appends notes via note.add', () => {
    const events = [
      {
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's',
        actor: 'a'
      },
      {
        kind: 'note.add',
        requirementId: 'REQ-0001',
        text: 'first note',
        agent: 'agent-a',
        actor: 'a'
      },
      {
        kind: 'note.add',
        requirementId: 'REQ-0001',
        text: 'second note',
        actor: 'a'
      }
    ];
    const state = buildState(events);
    expect(state.items[0].notes).toHaveLength(2);
    expect(state.items[0].notes[0].text).toBe('first note');
    expect(state.items[0].notes[0].agent).toBe('agent-a');
    expect(state.items[0].notes[1].agent).toBeNull();
  });

  it('skips events without kind or type', () => {
    const events = [
      { foo: 'bar' },
      null as unknown as Record<string, unknown>,
      undefined as unknown as Record<string, unknown>
    ];
    const state = buildState(events as never[]);
    expect(state.items).toEqual([]);
  });
});

describe('sorting', () => {
  const makeReq = (id: string, status: string, priority: string, updatedAt: string) => ({
    kind: 'req.new',
    requirementId: id,
    title: id,
    summary: 's',
    status,
    priority,
    updatedAt,
    actor: 'a'
  });

  it('sorts by status (todo → doing → paused → done)', () => {
    const events = [
      makeReq('REQ-0001', 'done', 'P1', '2026-01-04'),
      makeReq('REQ-0002', 'todo', 'P1', '2026-01-04'),
      makeReq('REQ-0003', 'doing', 'P1', '2026-01-04'),
      makeReq('REQ-0004', 'paused', 'P1', '2026-01-04')
    ];
    const state = buildState(events);
    expect(state.items.map((i) => i.id)).toEqual([
      'REQ-0002',
      'REQ-0003',
      'REQ-0004',
      'REQ-0001'
    ]);
  });

  it('sorts by priority within same status (P0 → P1 → P2)', () => {
    const events = [
      makeReq('REQ-0001', 'todo', 'P2', '2026-01-04'),
      makeReq('REQ-0002', 'todo', 'P0', '2026-01-04'),
      makeReq('REQ-0003', 'todo', 'P1', '2026-01-04')
    ];
    const state = buildState(events);
    expect(state.items.map((i) => i.id)).toEqual([
      'REQ-0002',
      'REQ-0003',
      'REQ-0001'
    ]);
  });

  it('sorts by updatedAt desc within same status+priority', () => {
    const events = [
      makeReq('REQ-0001', 'todo', 'P1', '2026-01-01'),
      makeReq('REQ-0002', 'todo', 'P1', '2026-01-05'),
      makeReq('REQ-0003', 'todo', 'P1', '2026-01-03')
    ];
    const state = buildState(events);
    expect(state.items.map((i) => i.id)).toEqual([
      'REQ-0002',
      'REQ-0003',
      'REQ-0001'
    ]);
  });
});