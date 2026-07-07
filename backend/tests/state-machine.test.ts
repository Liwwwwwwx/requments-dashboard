import { describe, expect, it } from 'vitest';
import {
  TERMINAL_REQUIREMENT_STATUSES,
  TERMINAL_TASK_STATUSES,
  assertRequirementTransition,
  assertTaskTransition
} from '../src/state-machine';

describe('terminal state sets', () => {
  it('requirement done is terminal', () => {
    expect(TERMINAL_REQUIREMENT_STATUSES.has('done')).toBe(true);
    expect(TERMINAL_REQUIREMENT_STATUSES.has('todo')).toBe(false);
  });

  it('task accepted is terminal', () => {
    expect(TERMINAL_TASK_STATUSES.has('accepted')).toBe(true);
    expect(TERMINAL_TASK_STATUSES.has('done')).toBe(false);
  });
});

describe('assertRequirementTransition', () => {
  it('allows todo → doing', () => {
    expect(() => assertRequirementTransition('todo', 'doing', 'REQ-0001')).not.toThrow();
  });

  it('allows doing → blocked', () => {
    expect(() => assertRequirementTransition('doing', 'blocked', 'REQ-0001')).not.toThrow();
  });

  it('allows blocked → done', () => {
    expect(() => assertRequirementTransition('blocked', 'done', 'REQ-0001')).not.toThrow();
  });

  it('allows done → done (idempotent)', () => {
    expect(() => assertRequirementTransition('done', 'done', 'REQ-0001')).not.toThrow();
  });

  it('rejects done → todo (terminal)', () => {
    expect(() => assertRequirementTransition('done', 'todo', 'REQ-0001')).toThrow(
      /状态机非法转移.*done 是终态/
    );
  });

  it('rejects done → doing (terminal)', () => {
    expect(() => assertRequirementTransition('done', 'doing', 'REQ-0001')).toThrow(
      /终态/
    );
  });

  it('does not throw when prev is missing', () => {
    expect(() => assertRequirementTransition(undefined, 'doing', 'REQ-0001')).not.toThrow();
  });

  it('does not throw for unknown prev status', () => {
    expect(() => assertRequirementTransition('unknown', 'doing', 'REQ-0001')).not.toThrow();
  });
});

describe('assertTaskTransition', () => {
  it('allows todo → working', () => {
    expect(() => assertTaskTransition('todo', 'working', 'REQ-0001', 'FE-1')).not.toThrow();
  });

  it('allows todo → done (skip-ahead via CLI)', () => {
    expect(() => assertTaskTransition('todo', 'done', 'REQ-0001', 'FE-1')).not.toThrow();
  });

  it('allows working → blocked', () => {
    expect(() => assertTaskTransition('working', 'blocked', 'REQ-0001', 'FE-1')).not.toThrow();
  });

  it('allows done → accepted', () => {
    expect(() => assertTaskTransition('done', 'accepted', 'REQ-0001', 'FE-1')).not.toThrow();
  });

  it('allows done → working (reopen)', () => {
    expect(() => assertTaskTransition('done', 'working', 'REQ-0001', 'FE-1')).not.toThrow();
  });

  it('rejects accepted → working (terminal)', () => {
    expect(() => assertTaskTransition('accepted', 'working', 'REQ-0001', 'FE-1')).toThrow(
      /accepted 是终态/
    );
  });

  it('rejects accepted → todo (terminal)', () => {
    expect(() => assertTaskTransition('accepted', 'todo', 'REQ-0001', 'FE-1')).toThrow(
      /终态/
    );
  });

  it('allows accepted → accepted (idempotent)', () => {
    expect(() => assertTaskTransition('accepted', 'accepted', 'REQ-0001', 'FE-1')).not.toThrow();
  });
});
