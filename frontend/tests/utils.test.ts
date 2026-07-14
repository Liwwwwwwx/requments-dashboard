import { describe, expect, it } from 'vitest';
import {
  priorityBarClass,
  priorityChipClass,
  priorityColor,
  statusChipClass,
  statusLabel,
  unique
} from '@/lib/utils';

describe('statusLabel', () => {
  it('returns requirement status labels', () => {
    expect(statusLabel('todo')).toEqual({ label: '待开始', color: 'default' });
    expect(statusLabel('doing')).toEqual({ label: '进行中', color: 'processing' });
    expect(statusLabel('done')).toEqual({ label: '完成', color: 'success' });
  });

  it('returns task status labels', () => {
    expect(statusLabel('blocked')).toEqual({ label: '阻塞', color: 'error' });
    expect(statusLabel('claimed')).toEqual({ label: '已领取', color: 'warning' });
  });

  it('falls back to the raw status when unknown', () => {
    expect(statusLabel('weird-state')).toEqual({ label: 'weird-state', color: 'default' });
  });
});

describe('priority helpers', () => {
  it('returns known chip and bar classes', () => {
    expect(priorityChipClass('P0')).toBe('chip-p0');
    expect(priorityBarClass('P1')).toBe('priority-p1');
  });

  it('falls back to P3 classes', () => {
    expect(priorityChipClass('P9')).toBe('chip-p3');
    expect(priorityBarClass('P9')).toBe('priority-p3');
  });

  it('returns known priority color', () => {
    expect(priorityColor('P0')).toBe('#ef4444');
    expect(priorityColor('P1')).toBe('#f59e0b');
    expect(priorityColor('P2')).toBe('#14b8a6');
  });

  it('falls back to gray for unknown priority', () => {
    expect(priorityColor('P9')).toBe('#94a3b8');
  });
});

describe('statusChipClass', () => {
  it('maps known statuses to chip classes', () => {
    expect(statusChipClass('doing')).toBe('chip-status-doing');
    expect(statusChipClass('working')).toBe('chip-status-doing');
  });

  it('falls back to todo chip class', () => {
    expect(statusChipClass('whatever')).toBe('chip-status-todo');
  });
});

describe('unique', () => {
  it('removes duplicates and falsy values', () => {
    expect(unique(['a', 'b', 'a', '', null, 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for all-falsy input', () => {
    expect(unique([null, undefined, '', 0, false])).toEqual([]);
  });
});
