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
        requirementType: 'feature',
        week: '2026-W28',
        dueDate: '2026-07-31',
        priority: 'P1',
        updatedAt: '2026-07-07',
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
    expect(req.createdBy).toBe('a');
    expect(req.createdAt).toBe('2026-07-07');
    expect(req.updatedAt).toBe('2026-07-07');
    expect(req).not.toHaveProperty('workflowStatus');
    expect(req).not.toHaveProperty('type');
    expect(req).not.toHaveProperty('week');
    expect(req).not.toHaveProperty('dueDate');
    expect(req).not.toHaveProperty('tasks');
    expect(req).not.toHaveProperty('taskStats');
    expect(req).not.toHaveProperty('contract');
    expect(req).not.toHaveProperty('needsContract');
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
    expect(state.items[0]).not.toHaveProperty('workflowStatus');
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

  it('replays legacy task events without exposing task fields', () => {
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
    expect(req).not.toHaveProperty('tasks');
    expect(req).not.toHaveProperty('taskStats');
  });

  it('keeps legacy task upsert compatibility out of the rendered requirement', () => {
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
    expect(state.items[0]).not.toHaveProperty('tasks');
  });

  it('replays legacy contract events without exposing contract fields', () => {
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
    expect(req).not.toHaveProperty('contract');
  });

  it('keeps empty legacy contracts out of the rendered requirement', () => {
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
    expect(state.items[0]).not.toHaveProperty('contract');
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

  it('sorts by status (todo → doing → blocked → done)', () => {
    const events = [
      makeReq('REQ-0001', 'done', 'P1', '2026-01-04'),
      makeReq('REQ-0002', 'todo', 'P1', '2026-01-04'),
      makeReq('REQ-0003', 'doing', 'P1', '2026-01-04'),
      makeReq('REQ-0004', 'blocked', 'P1', '2026-01-04')
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
