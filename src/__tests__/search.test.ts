/**
 * Tests for searchSnapshots and scoreMatch.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { LocalStorageBackend } from '../storage/local.js';
import { createSnapshot } from '../snapshot.js';
import { searchSnapshots, scoreMatch, clearSnapshotCache } from '../search.js';
import { saveIndex } from '../index-file.js';
import type { Adapter, Snapshot, SaveStateConfig } from '../types.js';

const PASSPHRASE = 'test-passphrase-search-12345';

function buildSnapshot(memories: Array<{ id: string; content: string }>, personality?: string): Snapshot {
  return {
    manifest: {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      id: '',
      platform: 'test',
      adapter: 'test',
      checksum: '',
      size: 0,
    },
    identity: { personality },
    memory: {
      core: memories.map((m) => ({
        id: m.id,
        content: m.content,
        source: 'test',
        createdAt: new Date().toISOString(),
      })),
      knowledge: [],
    },
    conversations: { total: 0, conversations: [] },
    platform: { name: 'test', exportMethod: 'test' },
    chain: { current: '', ancestors: [] },
    restoreHints: { platform: 'test', steps: [] },
  };
}

class FakeAdapter implements Adapter {
  readonly id = 'test';
  readonly name = 'Test';
  readonly platform = 'test';
  readonly version = '0.0.1';
  constructor(private snapshot: Snapshot) {}
  async detect() { return true; }
  async extract() { return this.snapshot; }
  async restore() {}
  async identify() { return { name: 'test', exportMethod: 'test' }; }
}

describe('searchSnapshots', () => {
  let testDir: string;
  let storage: LocalStorageBackend;
  let config: SaveStateConfig;

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-search-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    clearSnapshotCache();
    storage = new LocalStorageBackend({ path: join(testDir, 'snapshots') });
    config = {
      version: '1',
      storage: { type: 'local', options: { path: join(testDir, 'snapshots') } } as any,
      adapters: [],
    };
  });

  afterEach(async () => {
    process.chdir(tmpdir());
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns matches across memory entries with relevance scores', async () => {
    const snap = buildSnapshot([
      { id: 'm1', content: 'User prefers dark mode in their editor' },
      { id: 'm2', content: 'User loves Italian food and cocktails' },
    ]);
    const adapter = new FakeAdapter(snap);
    await createSnapshot(adapter, storage, PASSPHRASE);

    const results = await searchSnapshots('cocktail', config, { passphrase: PASSPHRASE });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('memory');
    expect(results[0].content).toContain('cocktails');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('searches identity personality content', async () => {
    const snap = buildSnapshot([], 'I am a senior engineer who values clarity above all.');
    const adapter = new FakeAdapter(snap);
    await createSnapshot(adapter, storage, PASSPHRASE);

    const results = await searchSnapshots('clarity', config, { passphrase: PASSPHRASE });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('identity');
  });

  it('respects --type filter', async () => {
    const snap = buildSnapshot(
      [{ id: 'm1', content: 'engineering preferences' }],
      'engineering values',
    );
    const adapter = new FakeAdapter(snap);
    await createSnapshot(adapter, storage, PASSPHRASE);

    const memOnly = await searchSnapshots('engineering', config, {
      passphrase: PASSPHRASE,
      types: ['memory'],
    });
    expect(memOnly.every((r) => r.type === 'memory')).toBe(true);
    expect(memOnly.length).toBe(1);
  });

  it('returns empty result for empty query', async () => {
    const results = await searchSnapshots('', config, { passphrase: PASSPHRASE });
    expect(results).toEqual([]);
  });

  it('returns empty result when no snapshots indexed', async () => {
    await saveIndex({ snapshots: [] });
    const results = await searchSnapshots('anything', config, { passphrase: PASSPHRASE });
    expect(results).toEqual([]);
  });

  it('returns identical results on a second call (cache warmth)', async () => {
    const snap = buildSnapshot([{ id: 'm1', content: 'cache test phrase' }]);
    const adapter = new FakeAdapter(snap);
    await createSnapshot(adapter, storage, PASSPHRASE);

    const first = await searchSnapshots('cache test', config, { passphrase: PASSPHRASE });
    const second = await searchSnapshots('cache test', config, { passphrase: PASSPHRASE });
    expect(first).toEqual(second);
    expect(first[0].content).toBe('cache test phrase');
  });

  it('limits the result count', async () => {
    const memories = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      content: `entry ${i} contains widget keyword`,
    }));
    const snap = buildSnapshot(memories);
    const adapter = new FakeAdapter(snap);
    await createSnapshot(adapter, storage, PASSPHRASE);

    const results = await searchSnapshots('widget', config, {
      passphrase: PASSPHRASE,
      limit: 3,
    });
    expect(results.length).toBe(3);
  });
});

describe('scoreMatch', () => {
  it('returns 0 when no overlap', () => {
    expect(scoreMatch('alpha', 'beta gamma')).toBe(0);
  });

  it('rewards exact phrase matches', () => {
    const exact = scoreMatch('hello world', 'hello world');
    const partial = scoreMatch('hello world', 'world hello text');
    expect(exact).toBeGreaterThan(partial);
  });

  it('partially scores word-level fallback', () => {
    const score = scoreMatch('alpha beta', 'something alpha here');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.5);
  });
});
