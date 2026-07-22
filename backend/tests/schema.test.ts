import { describe, expect, it } from 'vitest';
import {
  KnownKinds,
  Priority,
  RequirementId,
  Role,
  TaskId,
  validateBatch,
  validateEvent
} from '../src/schema';

describe('validateEvent', () => {
  describe('req.* events', () => {
    it('accepts a valid req.new', () => {
      const ev = {
        kind: 'req.new',
        actor: 'tester',
        requirementId: 'REQ-0001',
        title: '实现 X',
        summary: '...',
        priority: 'P1'
      };
      const result = validateEvent(ev);
      expect(result.kind).toBe('req.new');
      expect(result.requirementId).toBe('REQ-0001');
      expect(result.eventId).toBeUndefined();
      expect(result.ts).toBeUndefined();
    });

    it('accepts req.delete with a requirementId', () => {
      expect(validateEvent({ kind: 'req.delete', requirementId: 'REQ-0001', actor: 'tester' }).kind).toBe('req.delete');
    });

    it('rejects req.new without requirementId', () => {
      const ev = { kind: 'req.new', title: 't', summary: 's' };
      expect(() => validateEvent(ev)).toThrow(/req.new.*必须包含 requirementId/);
    });

    it('rejects req.new with malformed requirementId', () => {
      const ev = { kind: 'req.new', requirementId: 'BAD-001', title: 't', summary: 's' };
      expect(() => validateEvent(ev)).toThrow(/requirementId 必须是 REQ-NNNN/);
    });

    it('accepts blocked as a requirement status', () => {
      const ev = {
        kind: 'req.status',
        requirementId: 'REQ-0001',
        status: 'blocked'
      };
      expect(validateEvent(ev).status).toBe('blocked');
    });

    it('rejects paused as a requirement status in V2', () => {
      const ev = {
        kind: 'req.status',
        requirementId: 'REQ-0001',
        status: 'paused'
      };
      expect(() => validateEvent(ev)).toThrow(/status/);
    });

    it('preserves caller-provided eventId and ts', () => {
      const ev = {
        eventId: 'EVT-CUSTOM',
        ts: 1700000000000,
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's'
      };
      const result = validateEvent(ev);
      expect(result.eventId).toBe('EVT-CUSTOM');
      expect(result.ts).toBe(1700000000000);
    });
  });

  describe('task.* events', () => {
    it('accepts a valid task.status', () => {
      const ev = {
        kind: 'task.status',
        actor: 'tester',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        status: 'working'
      };
      const result = validateEvent(ev);
      expect(result.kind).toBe('task.status');
      expect(result.taskId).toBe('FE-1');
    });

    it('rejects task.status without requirementId', () => {
      const ev = { kind: 'task.status', taskId: 'FE-1', status: 'working' };
      expect(() => validateEvent(ev)).toThrow(/task.status/);
    });

    it('rejects task.status without taskId', () => {
      const ev = { kind: 'task.status', requirementId: 'REQ-0001', status: 'working' };
      expect(() => validateEvent(ev)).toThrow(/task.status/);
    });

    it('rejects malformed taskId', () => {
      const ev = {
        kind: 'task.status',
        requirementId: 'REQ-0001',
        taskId: 'FE-XX',
        status: 'working'
      };
      expect(() => validateEvent(ev)).toThrow(/taskId 格式不合法/);
    });

    it('accepts all known task id prefixes', () => {
      for (const id of ['CONTRACT-1', 'FE-2', 'BE-3', 'REVIEW-4', 'QA-5', 'INT-6', 'INFRA-7']) {
        const ev = {
          kind: 'task.status',
          requirementId: 'REQ-0001',
          taskId: id,
          status: 'working'
        };
        expect(() => validateEvent(ev)).not.toThrow();
      }
    });
  });

  describe('contract.set and note.add', () => {
    it('accepts contract.set with endpoints', () => {
      const ev = {
        kind: 'contract.set',
        requirementId: 'REQ-0001',
        endpoints: [{ method: 'POST', path: '/api/x' }]
      };
      expect(() => validateEvent(ev)).not.toThrow();
    });

    it('accepts note.add', () => {
      const ev = {
        kind: 'note.add',
        requirementId: 'REQ-0001',
        text: 'blocked by contract',
        agent: 'agent-a'
      };
      expect(() => validateEvent(ev)).not.toThrow();
    });
  });

  describe('unknown / malformed kinds', () => {
    it('rejects unknown kind', () => {
      const ev = { kind: 'unknown.kind', requirementId: 'REQ-0001' };
      expect(() => validateEvent(ev)).toThrow(/事件校验失败/);
    });

    it('rejects missing kind', () => {
      const ev = { requirementId: 'REQ-0001' };
      expect(() => validateEvent(ev)).toThrow(/事件校验失败/);
    });
  });
});

describe('validateBatch', () => {
  it('returns valid=true when all events pass', () => {
    const events = [
      { kind: 'req.new', requirementId: 'REQ-0001', title: 'a', summary: 's' },
      { kind: 'req.new', requirementId: 'REQ-0002', title: 'b', summary: 's' }
    ];
    const result = validateBatch(events);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns index of failing events', () => {
    const events = [
      { kind: 'req.new', requirementId: 'REQ-0001', title: 'a', summary: 's' },
      { kind: 'req.new', requirementId: 'BAD', title: 'b', summary: 's' },
      { kind: 'req.new', requirementId: 'REQ-0003', title: 'c', summary: 's' }
    ];
    const result = validateBatch(events);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
  });
});

describe('schema exports', () => {
  it('exposes known kinds', () => {
    expect(KnownKinds).toContain('req.new');
    expect(KnownKinds).toContain('task.status');
    expect(KnownKinds).toContain('contract.set');
    expect(KnownKinds).toContain('note.add');
  });

  it('RequirementId parses valid ids', () => {
    expect(RequirementId.safeParse('REQ-0001').success).toBe(true);
    expect(RequirementId.safeParse('BAD').success).toBe(false);
  });

  it('TaskId parses valid ids', () => {
    expect(TaskId.safeParse('FE-1').success).toBe(true);
    expect(TaskId.safeParse('FE-XX').success).toBe(false);
    expect(TaskId.safeParse('INVALID-1').success).toBe(false);
  });

  it('Role enum exposes all roles', () => {
    for (const role of [
      'contract',
      'frontend',
      'backend',
      'review',
      'qa',
      'integration',
      'infra',
      'general'
    ]) {
      expect(Role.safeParse(role).success).toBe(true);
    }
    expect(Role.safeParse('unknown').success).toBe(false);
  });

  it('Priority enum accepts only P0/P1/P2', () => {
    expect(Priority.safeParse('P0').success).toBe(true);
    expect(Priority.safeParse('P1').success).toBe(true);
    expect(Priority.safeParse('P2').success).toBe(true);
    expect(Priority.safeParse('P3').success).toBe(false);
  });
});
