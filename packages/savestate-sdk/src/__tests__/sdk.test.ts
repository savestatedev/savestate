/**
 * SDK end-to-end tests.
 *
 * Strategy: spin up a SaveStateClient against a tmp local-storage backend,
 * snapshot through a FakeAdapter (same pattern as src/__tests__/search.test.ts),
 * then exercise the public surface. We stay above the line — the engine
 * already has unit coverage; here we just want to prove the SDK wiring.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { SaveStateClient } from '../index.js';
import { LocalStorageBackend } from '../../../../src/storage/local.js';
import { clearSnapshotCache } from '../../../../src/search.js';
import type { Adapter, Snapshot } from '../../../../src/types.js';

const PASSPHRASE = 'sdk-test-passphrase-67890';

function buildSnapshot(memories: Array<{ id: string; content: string }>): Snapshot {
  return {
    manifest: {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      id: '',
      platform: 'sdk-test',
      adapter: 'sdk-test',
      checksum: '',
      size: 0,
    },
    identity: {},
    memory: {
      core: memories.map((m) => ({
        id: m.id,
        content: m.content,
        source: 'sdk-test',
        createdAt: new Date().toISOString(),
      })),
      knowledge: [],
    },
    conversations: { total: 0, conversations: [] },
    platform: { name: 'sdk-test', exportMethod: 'sdk-test' },
    chain: { current: '', ancestors: [] },
    restoreHints: { platform: 'sdk-test', steps: [] },
  };
}

class FakeAdapter implements Adapter {
  readonly id = 'sdk-test';
  readonly name = 'SDK Test';
  readonly platform = 'sdk-test';
  readonly version = '0.0.1';
  public lastRestored?: Snapshot;
  constructor(private snapshot: Snapshot) {}
  async detect() {
    return true;
  }
  async extract() {
    return this.snapshot;
  }
  async restore(snap: Snapshot) {
    this.lastRestored = snap;
  }
  async identify() {
    return { name: 'sdk-test', exportMethod: 'sdk-test' };
  }
}

describe('SaveStateClient', () => {
  let testDir: string;
  let client: SaveStateClient;
  let storagePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-sdk-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    clearSnapshotCache();

    storagePath = join(testDir, 'snapshots');
    client = new SaveStateClient({
      passphrase: PASSPHRASE,
      storage: { type: 'local', path: storagePath },
      memoryDbPath: join(testDir, 'memory.db'),
    });
  });

  afterEach(async () => {
    process.chdir(tmpdir());
    await rm(testDir, { recursive: true, force: true });
  });

  it('snapshots through a custom adapter and indexes the result', async () => {
    const adapter = new FakeAdapter(
      buildSnapshot([{ id: 'm1', content: 'User loves negronis and dark mode.' }]),
    );

    const result = await client.snapshot({ adapter, label: 'first' });
    expect(result.snapshot.manifest.id).toBeTruthy();
    expect(result.snapshot.manifest.label).toBe('first');

    const list = await client.list();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('first');
  });

  it('searches across snapshot contents with scored results', async () => {
    const adapter = new FakeAdapter(
      buildSnapshot([
        { id: 'm1', content: 'User prefers Italian food and cocktails' },
        { id: 'm2', content: 'User wakes up at 6am every day' },
      ]),
    );
    await client.snapshot({ adapter });

    const hits = await client.search('cocktail', { limit: 5 });
    expect(hits.length).toBe(1);
    expect(hits[0].type).toBe('memory');
    expect(hits[0].content).toContain('cocktails');
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it('restores a snapshot via the adapter (round-trip)', async () => {
    const original = buildSnapshot([{ id: 'm1', content: 'restore-me' }]);
    const adapter = new FakeAdapter(original);
    const created = await client.snapshot({ adapter });

    const fresh = new FakeAdapter(buildSnapshot([]));
    const restoreResult = await client.restore(created.snapshot.manifest.id, {
      adapter: fresh,
    });

    expect(restoreResult.snapshotId).toBe(created.snapshot.manifest.id);
    expect(restoreResult.memoryCount).toBe(1);
    expect(fresh.lastRestored?.memory.core[0].content).toBe('restore-me');
  });

  it('reports stats aggregated across snapshots', async () => {
    const adapter = new FakeAdapter(buildSnapshot([{ id: 'm1', content: 'a' }]));
    await client.snapshot({ adapter, label: 'one', tags: ['alpha'] });
    await client.snapshot({ adapter, label: 'two', tags: ['alpha', 'beta'] });

    const stats = await client.stats();
    expect(stats.total).toBe(2);
    expect(stats.byAdapter['sdk-test']).toBe(2);
    expect(stats.tagCount).toBe(2);
  });

  it('filters list by adapter and tag', async () => {
    const adapter = new FakeAdapter(buildSnapshot([{ id: 'm1', content: 'a' }]));
    await client.snapshot({ adapter, tags: ['alpha'] });
    await client.snapshot({ adapter, tags: ['beta'] });

    const alphaOnly = await client.list({ tag: 'alpha' });
    expect(alphaOnly).toHaveLength(1);
    expect(alphaOnly[0].tags).toContain('alpha');

    const wrongAdapter = await client.list({ adapter: 'nope' });
    expect(wrongAdapter).toHaveLength(0);
  });

  it('exposes a live memory handle backed by SQLite', async () => {
    const mem = client.memory();
    const created = await mem.add({ type: 'fact', content: 'User prefers dark mode' });
    expect(created.id).toBeTruthy();

    const hits = await mem.search({ search: 'dark mode' });
    expect(hits).toHaveLength(1);
    expect(hits[0].content).toBe('User prefers dark mode');

    const stats = mem.stats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.byType.fact).toBe(1);
  });

  it('throws a clear error when no passphrase is configured', async () => {
    const noPass = new SaveStateClient({
      storage: { type: 'local', path: storagePath },
    });
    const adapter = new FakeAdapter(buildSnapshot([{ id: 'm1', content: 'x' }]));
    const prev = process.env.SAVESTATE_PASSPHRASE;
    delete process.env.SAVESTATE_PASSPHRASE;
    try {
      await expect(noPass.snapshot({ adapter })).rejects.toThrow(/passphrase/i);
    } finally {
      if (prev !== undefined) process.env.SAVESTATE_PASSPHRASE = prev;
    }
  });

  it('accepts a pre-built StorageBackend (for tests / custom backends)', async () => {
    const backendClient = new SaveStateClient({
      passphrase: PASSPHRASE,
      storage: { type: 'local', path: storagePath },
      storageBackend: new LocalStorageBackend({ path: storagePath }),
    });
    const adapter = new FakeAdapter(buildSnapshot([{ id: 'm1', content: 'override-test' }]));
    const result = await backendClient.snapshot({ adapter });
    expect(result.snapshot.manifest.id).toBeTruthy();
  });
});
