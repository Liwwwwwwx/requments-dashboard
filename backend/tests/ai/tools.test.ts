import { describe, it, expect } from 'vitest';
import { validateProposedEvents, PROPOSE_EVENTS_TOOL } from '@/ai/tools/propose-events';

describe('ai/tools/propose-events', () => {
  it('PROPOSE_EVENTS_TOOL 是合法 OpenAI 工具 schema', () => {
    expect(PROPOSE_EVENTS_TOOL.type).toBe('function');
    expect(PROPOSE_EVENTS_TOOL.function.name).toBe('propose_events');
    expect(PROPOSE_EVENTS_TOOL.function.parameters.required).toContain('events');
    const kinds = PROPOSE_EVENTS_TOOL.function.parameters.properties.events.items.properties.kind.enum;
    expect(kinds).toEqual(['req.status', 'req.patch', 'note.add']);
  });

  it('validateProposedEvents 接受合法事件', () => {
    const events = [
      { kind: 'req.status', requirementId: 'REQ-0001', status: 'doing' },
      { kind: 'req.patch', requirementId: 'REQ-0001', summary: '更新描述', priority: 'P1' },
      { kind: 'note.add', requirementId: 'REQ-0001', text: '建议先补登录错误提示' }
    ];
    const r = validateProposedEvents(events);
    expect(r.valid).toBe(true);
    expect(r.errors).toBeUndefined();
    expect(r.events).toHaveLength(3);
  });

  it('validateProposedEvents 拒绝非 MVP 提案事件', () => {
    const r = validateProposedEvents([
      { kind: 'req.new', requirementId: 'REQ-0002', title: '新需求', summary: '不应由 AI 直接创建' },
      { kind: 'task.status', requirementId: 'REQ-0001', taskId: 'FE-1', status: 'working' },
      { kind: 'contract.set', requirementId: 'REQ-0001', endpoints: [] }
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(3);
    expect(r.errors.join('\n')).toContain('不允许');
  });

  it('validateProposedEvents 拒绝非法事件', () => {
    const events = [
      { kind: 'req.status', requirementId: 'BAD', status: 'doing' },
      { kind: 'note.add', requirementId: 'REQ-0001' },
      { kind: 'req.status', requirementId: 'REQ-0001' },
      { kind: 'req.patch', requirementId: 'REQ-0001', priority: 'P9' },
      { kind: 'req.patch', requirementId: 'REQ-0001', title: '   ' }
    ];
    const r = validateProposedEvents(events);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(5);
    expect(r.errors[0]).toContain('requirementId');
    expect(r.errors[1]).toContain('text');
    expect(r.errors[2]).toContain('status');
    expect(r.errors[3]).toContain('priority');
    expect(r.errors[4]).toContain('title');
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
