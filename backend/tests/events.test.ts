import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendEvents, createEventId, readEvents, withLock } from '../src/events';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-events-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createEventId', () => {
  it('starts with EVT-', () => {
    expect(createEventId()).toMatch(/^EVT-\d+-[a-z0-9]+$/);
  });

  it('returns unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createEventId()));
    expect(ids.size).toBe(100);
  });
});

describe('readEvents', () => {
  it('returns empty array when db file does not exist', () => {
    const result = readEvents(path.join(tmpDir, 'nope.db'));
    expect(result).toEqual([]);
  });

  it('returns empty array for fresh project with no events', () => {
    const result = readEvents(path.join(tmpDir, 'fresh.db'));
    expect(result).toEqual([]);
  });

  it('reads events back in ts order', () => {
    const p = path.join(tmpDir, 'events.db');
    appendEvents(p, [
      { eventId: 'a', ts: 200, kind: 'req.status', requirementId: 'REQ-0001', status: 'doing' },
      { eventId: 'b', ts: 100, kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' }
    ]);
    const events = readEvents(p);
    expect(events.map((e) => e.eventId)).toEqual(['b', 'a']);
  });

  it('preserves insert order for events with the same ts', () => {
    const p = path.join(tmpDir, 'events.db');
    appendEvents(p, [
      { eventId: 'a', ts: 100, kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' },
      { eventId: 'b', ts: 100, kind: 'note.add', requirementId: 'REQ-0001', text: 'note' }
    ]);
    const events = readEvents(p);
    expect(events.map((e) => e.eventId)).toEqual(['a', 'b']);
  });
});

describe('appendEvents', () => {
  it('creates the parent directory if missing', () => {
    const p = path.join(tmpDir, 'nested', 'events.db');
    appendEvents(p, [{ kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' }]);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('inserts events and returns normalized list', () => {
    const p = path.join(tmpDir, 'events.db');
    const result = appendEvents(p, [
      { kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' }
    ]);
    expect(result[0].eventId).toMatch(/^EVT-/);
    expect(typeof result[0].ts).toBe('number');
  });

  it('preserves caller-provided eventId and ts', () => {
    const p = path.join(tmpDir, 'events.db');
    const result = appendEvents(p, [
      {
        eventId: 'EVT-CUSTOM',
        ts: 1700000000000,
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's'
      }
    ]);
    expect(result[0].eventId).toBe('EVT-CUSTOM');
    expect(result[0].ts).toBe(1700000000000);
  });

  it('rejects events that fail schema validation', () => {
    const p = path.join(tmpDir, 'events.db');
    expect(() =>
      appendEvents(p, [{ kind: 'req.new' } as unknown as Record<string, unknown>])
    ).toThrow(/事件校验失败/);
  });

  it('inserts multiple events atomically (transaction)', () => {
    const p = path.join(tmpDir, 'events.db');
    appendEvents(p, [
      { eventId: 'a', ts: 100, kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' },
      { eventId: 'b', ts: 200, kind: 'req.status', requirementId: 'REQ-0001', status: 'doing' },
      { eventId: 'c', ts: 300, kind: 'task.new', requirementId: 'REQ-0001', taskId: 'FE-1', role: 'frontend' }
    ]);
    expect(readEvents(p)).toHaveLength(3);
  });

  it('rejects duplicate eventId', () => {
    const p = path.join(tmpDir, 'events.db');
    appendEvents(p, [
      { eventId: 'dup', ts: 1, kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' }
    ]);
    expect(() =>
      appendEvents(p, [
        { eventId: 'dup', ts: 2, kind: 'req.status', requirementId: 'REQ-0001', status: 'doing' }
      ])
    ).toThrow();
  });
});

describe('withLock', () => {
  it('runs the action and releases the lock', () => {
    const lockPath = path.join(tmpDir, '.lock');
    const result = withLock(lockPath, () => 42);
    expect(result).toBe(42);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('creates the parent directory if missing', () => {
    const lockPath = path.join(tmpDir, 'nested', '.lock');
    withLock(lockPath, () => 'ok');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('serializes concurrent access to the same lock path', () => {
    const lockPath = path.join(tmpDir, '.lock');
    const trace: number[] = [];

    const slow = () =>
      withLock(lockPath, () => {
        trace.push(1);
        const until = Date.now() + 80;
        while (Date.now() < until) {
          /* spin */
        }
        trace.push(2);
        return 'first';
      });

    const fast = () =>
      withLock(lockPath, () => {
        trace.push(3);
        return 'second';
      });

    return Promise.all([Promise.resolve().then(slow), Promise.resolve().then(fast)]).then(
      ([a, b]) => {
        expect(a).toBe('first');
        expect(b).toBe('second');
        expect(trace).toEqual([1, 2, 3]);
      }
    );
  });
});
