import { describe, it, expect } from 'vitest';
import { validateProposedEvents, PROPOSE_EVENTS_TOOL } from '@/ai/tools/propose-events';

describe('ai/tools/propose-events', () => {
  it('PROPOSE_EVENTS_TOOL 是合法 OpenAI 工具 schema', () => {
    expect(PROPOSE_EVENTS_TOOL.type).toBe('function');
    expect(PROPOSE_EVENTS_TOOL.function.name).toBe('propose_events');
    expect(PROPOSE_EVENTS_TOOL.function.parameters.required).toContain('events');
  });

  it('validateProposedEvents 接受合法事件', () => {
    const events = [
      { kind: 'req.new', requirementId: 'REQ-0001', title: 'x', summary: 'y', priority: 'P1' },
      { kind: 'task.status', requirementId: 'REQ-0001', taskId: 'FE-1', status: 'working' }
    ];
    const r = validateProposedEvents(events);
    expect(r.valid).toBe(true);
    expect(r.errors).toBeUndefined();
    expect(r.events).toHaveLength(2);
  });

  it('validateProposedEvents 拒绝非法事件', () => {
    const events = [
      { kind: 'req.new', requirementId: 'BAD', title: 'x' }, // requirementId 非法
      { kind: 'task.status', requirementId: 'REQ-0001', taskId: 'BAD-XX', status: 'working' } // taskId 非法
    ];
    const r = validateProposedEvents(events);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toContain('requirementId');
    expect(r.errors[1]).toContain('taskId');
  });

  it('validateProposedEvents 拒绝非数组', () => {
    const r = validateProposedEvents('not-array');
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain('数组');
  });

  it('validateProposedEvents 拒绝非对象项', () => {
    const r = validateProposedEvents([null, 'x']);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(2);
  });
});