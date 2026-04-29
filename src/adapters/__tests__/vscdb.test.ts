/**
 * Tests for the shared VS Code-style state.vscdb reader used by the
 * Cursor and Windsurf adapters (chat history extraction).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';

import {
  readVscdbRows,
  listWorkspaceDbs,
  coerceConversations,
  buildConversationsIndex,
} from '../_lib/vscdb.js';

function seedDb(dbPath: string, rows: Array<{ key: string; value: unknown }>): void {
  const db = new Database(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT)');
  const stmt = db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)');
  for (const r of rows) stmt.run(r.key, JSON.stringify(r.value));
  db.close();
}

describe('readVscdbRows', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = join(tmpdir(), `savestate-vscdb-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(tmp, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns rows whose key starts with any prefix', () => {
    const dbPath = join(tmp, 'state.vscdb');
    seedDb(dbPath, [
      { key: 'composer.session1', value: { messages: [] } },
      { key: 'cascade.session1', value: { messages: [] } },
      { key: 'unrelated.thing', value: 42 },
    ]);

    const cursorRows = readVscdbRows(dbPath, ['composer.', 'aiService.']);
    expect(cursorRows.map((r) => r.key)).toEqual(['composer.session1']);

    const windsurfRows = readVscdbRows(dbPath, ['cascade.', 'codeium.']);
    expect(windsurfRows.map((r) => r.key)).toEqual(['cascade.session1']);
  });

  it('returns [] for missing files', () => {
    const rows = readVscdbRows(join(tmp, 'does-not-exist.vscdb'), ['anything.']);
    expect(rows).toEqual([]);
  });

  it('parses JSON values when possible, falls back to strings otherwise', () => {
    const dbPath = join(tmp, 'mixed.vscdb');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)');
    db.prepare('INSERT INTO ItemTable VALUES (?, ?)').run('composer.json', '{"a":1}');
    db.prepare('INSERT INTO ItemTable VALUES (?, ?)').run('composer.text', 'not-json');
    db.close();

    const rows = readVscdbRows(dbPath, ['composer.']);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey['composer.json']).toEqual({ a: 1 });
    expect(byKey['composer.text']).toBe('not-json');
  });

  it('returns [] for malformed dbs without throwing', async () => {
    // Write a non-SQLite file at the path
    const dbPath = join(tmp, 'corrupt.vscdb');
    await writeFile(dbPath, 'not a sqlite db');
    const rows = readVscdbRows(dbPath, ['composer.']);
    expect(rows).toEqual([]);
  });
});

describe('listWorkspaceDbs', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = join(tmpdir(), `savestate-ws-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(tmp, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('finds state.vscdb under each per-workspace hash dir', async () => {
    await mkdir(join(tmp, 'aaa111'), { recursive: true });
    await mkdir(join(tmp, 'bbb222'), { recursive: true });
    seedDb(join(tmp, 'aaa111', 'state.vscdb'), []);
    seedDb(join(tmp, 'bbb222', 'state.vscdb'), []);
    // No DB in this one
    await mkdir(join(tmp, 'ccc333'), { recursive: true });

    const dbs = listWorkspaceDbs(tmp);
    expect(dbs.length).toBe(2);
    expect(dbs.every((p) => p.endsWith('state.vscdb'))).toBe(true);
  });

  it('returns [] for missing root', () => {
    expect(listWorkspaceDbs(join(tmp, 'nope'))).toEqual([]);
  });
});

describe('coerceConversations', () => {
  it('extracts a single conversation from {id, messages}', () => {
    const out = coerceConversations(
      {
        id: 'sess-1',
        title: 'Cocktail thread',
        messages: [
          { role: 'user', content: 'recommend a cocktail' },
          { role: 'assistant', content: 'try a negroni' },
        ],
      },
      'cursor:composer.session1',
    );
    expect(out.length).toBe(1);
    expect(out[0].id).toBe('sess-1');
    expect(out[0].title).toBe('Cocktail thread');
    expect(out[0].messages.length).toBe(2);
    expect(out[0].messages[0].role).toBe('user');
  });

  it('recurses into wrapper shapes (tabs / chats / sessions)', () => {
    const out = coerceConversations(
      {
        tabs: [
          { id: 'a', messages: [{ role: 'user', content: 'hi' }] },
          { id: 'b', messages: [{ role: 'user', content: 'hey' }] },
        ],
      },
      'cursor:composer.tabs',
    );
    expect(out.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('normalizes human/ai/bot roles to user/assistant', () => {
    const out = coerceConversations(
      { id: 'r1', messages: [{ role: 'human', content: 'hi' }, { role: 'ai', content: 'hello' }] },
      'src',
    );
    expect(out[0].messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('returns [] for shapes that look nothing like a conversation', () => {
    expect(coerceConversations(42, 'src')).toEqual([]);
    expect(coerceConversations(null, 'src')).toEqual([]);
    expect(coerceConversations({ a: 1 }, 'src')).toEqual([]);
  });

  it('falls back to text field when content is missing', () => {
    const out = coerceConversations(
      { id: 'fb', messages: [{ role: 'user', text: 'fallback works' }] },
      'src',
    );
    expect(out[0].messages[0].content).toBe('fallback works');
  });
});

describe('buildConversationsIndex', () => {
  it('builds index + threads with safe filenames', () => {
    const out = buildConversationsIndex(
      [
        {
          id: 'has spaces and slashes/foo',
          title: 't',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:00Z' }],
        },
      ],
      'conversations/threads',
    );
    expect(out.index.total).toBe(1);
    const filename = out.index.conversations[0].path;
    expect(filename).toMatch(/^conversations\/threads\/has_spaces_and_slashes_foo\.json$/);
    expect(out.threads[filename]).toContain('"hi"');
  });
});
