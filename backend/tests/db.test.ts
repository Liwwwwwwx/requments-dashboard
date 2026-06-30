import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eventToRow, migrateFromJsonl, openDb, rowToEvent } from '../src/db';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-db-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('openDb', () => {
  it('creates the parent directory and db file', () => {
    const p = path.join(tmpDir, 'nested', 'events.db');
    const db = openDb(p);
    try {
      expect(fs.existsSync(p)).toBe(true);
    } finally {
      db.close();
    }
  });

  it('creates the events table on first open', () => {
    const p = path.join(tmpDir, 'events.db');
    const db = openDb(p);
    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
        .all();
      expect(tables).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('creates the expected indexes', () => {
    const p = path.join(tmpDir, 'events.db');
    const db = openDb(p);
    try {
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_events_%'"
        )
        .all() as { name: string }[];
      const names = indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_events_ts');
      expect(names).toContain('idx_events_requirement');
      expect(names).toContain('idx_events_task');
      expect(names).toContain('idx_events_kind');
      expect(names).toContain('idx_events_project_kind');
    } finally {
      db.close();
    }
  });

  it('enables WAL mode', () => {
    const p = path.join(tmpDir, 'events.db');
    const db = openDb(p);
    try {
      const mode = db.pragma('journal_mode', { simple: true });
      expect(mode).toBe('wal');
    } finally {
      db.close();
    }
  });

  it('is idempotent (re-running schema is safe)', () => {
    const p = path.join(tmpDir, 'events.db');
    openDb(p).close();
    expect(() => openDb(p).close()).not.toThrow();
  });
});

describe('rowToEvent / eventToRow', () => {
  it('roundtrips a full event', () => {
    const event = {
      eventId: 'EVT-1',
      ts: 1700000000000,
      kind: 'req.new',
      actor: 'tester',
      project: 'default',
      requirementId: 'REQ-0001',
      title: 't',
      summary: 's',
      detail: { scope: [], nonGoals: [], next: '' }
    };
    const row = eventToRow(event);
    const restored = rowToEvent(row);
    expect(restored).toEqual(event);
  });

  it('returns null for null row', () => {
    expect(rowToEvent(null)).toBeNull();
  });

  it('handles missing optional fields', () => {
    const event = {
      eventId: 'EVT-2',
      ts: 1,
      kind: 'req.new',
      title: 't',
      summary: 's',
      requirementId: 'REQ-0001'
    };
    const row = eventToRow(event);
    expect(row.project).toBeNull();
    expect(row.actor).toBeNull();
    expect(row.task_id).toBeNull();
  });
});

describe('migrateFromJsonl', () => {
  it('returns migrated=0 when jsonl does not exist', () => {
    const result = migrateFromJsonl(
      path.join(tmpDir, 'events.db'),
      path.join(tmpDir, 'nope.jsonl')
    );
    expect(result.migrated).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'events.db'))).toBe(false);
  });

  it('imports events from jsonl and deletes the source', () => {
    const jsonl = path.join(tmpDir, 'events.jsonl');
    fs.writeFileSync(
      jsonl,
      [
        JSON.stringify({
          eventId: 'a',
          ts: 100,
          kind: 'req.new',
          requirementId: 'REQ-0001',
          title: 't',
          summary: 's'
        }),
        JSON.stringify({
          eventId: 'b',
          ts: 200,
          kind: 'req.status',
          requirementId: 'REQ-0001',
          status: 'doing'
        })
      ].join('\n') + '\n'
    );
    const result = migrateFromJsonl(path.join(tmpDir, 'events.db'), jsonl);
    expect(result.migrated).toBe(2);
    expect(fs.existsSync(jsonl)).toBe(false);

    // Verify data was imported
    const db = openDb(path.join(tmpDir, 'events.db'));
    try {
      const rows = db.prepare('SELECT id FROM events ORDER BY ts').all() as { id: string }[];
      expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    } finally {
      db.close();
    }
  });

  it('skips when db already has events (does not delete jsonl)', () => {
    const jsonl = path.join(tmpDir, 'events.jsonl');
    const dbPath = path.join(tmpDir, 'events.db');
    fs.writeFileSync(
      jsonl,
      JSON.stringify({
        eventId: 'a',
        ts: 1,
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: 't',
        summary: 's'
      }) + '\n'
    );
    // Pre-populate the db with one event
    const db = openDb(dbPath);
    try {
      db.prepare(
        'INSERT INTO events (id, ts, kind, requirement_id, payload) VALUES (?, ?, ?, ?, ?)'
      ).run('existing', 1, 'req.new', 'REQ-0001', JSON.stringify({ eventId: 'existing', ts: 1, kind: 'req.new', requirementId: 'REQ-0001', title: 't', summary: 's' }));
    } finally {
      db.close();
    }
    const result = migrateFromJsonl(dbPath, jsonl);
    expect(result.skipped).toBe(true);
    expect(result.migrated).toBe(0);
    expect(fs.existsSync(jsonl)).toBe(true); // jsonl preserved
  });

  it('throws on invalid jsonl', () => {
    const jsonl = path.join(tmpDir, 'events.jsonl');
    fs.writeFileSync(jsonl, `${JSON.stringify({ eventId: 'a', kind: 'req.new', ts: 1 })}\nNOT_JSON\n`);
    expect(() => migrateFromJsonl(path.join(tmpDir, 'events.db'), jsonl)).toThrow(/Invalid JSONL/);
  });
});