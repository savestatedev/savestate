/**
 * Tests for the per-snapshot inverted search index.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { LocalStorageBackend } from '../storage/local.js';
import { createSnapshot } from '../snapshot.js';
import { searchSnapshots, clearSnapshotCache } from '../search.js';
import { buildSearchIndex, tokenize, SEARCH_INDEX_VERSION } from '../search/index-builder.js';
import { decrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot } from '../format.js';
import type { Adapter, Snapshot, SaveStateConfig } from '../types.js';

const PASSPHRASE = 'test-passphrase-search-index-12345';

function buildSnapshot(
  memories: Array<{ id: string; content: string }>,
  personality?: string,
): Snapshot {
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

describe('buildSearchIndex', () => {
  it('produces deterministic output for the same input', () => {
    const snap = buildSnapshot([
      { id: 'm1', content: 'alpha beta gamma' },
      { id: 'm2', content: 'delta epsilon' },
    ], 'a senior engineer who values clarity');

    const a = buildSearchIndex(snap);
    const b = buildSearchIndex(snap);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.version).toBe(SEARCH_INDEX_VERSION);
  });

  it('lowercases, splits on non-alphanumerics, and drops short tokens', () => {
    const snap = buildSnapshot([
      { id: 'm1', content: 'Hello, World! Multi-Char-Token; mix3d 1' },
    ]);
    const idx = buildSearchIndex(snap);
    const tokens = Object.keys(idx.tokens);
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('multi');
    expect(tokens).toContain('char');
    expect(tokens).toContain('token');
    expect(tokens).toContain('mix3d');
    // single-character tokens (the trailing '1') must be dropped
    expect(tokens).not.toContain('1');
    // upper-cased input must be normalized
    expect(tokens).not.toContain('Hello');
  });

  it('de-duplicates postings within a token', () => {
    // Same token "alpha" appears multiple times in same memory entry —
    // posting list should still have a single (memory, m1) entry.
    const snap = buildSnapshot([
      { id: 'm1', content: 'alpha alpha alpha alpha' },
    ]);
    const idx = buildSearchIndex(snap);
    expect(idx.tokens['alpha']).toHaveLength(1);
    expect(idx.tokens['alpha'][0]).toEqual({
      type: 'memory',
      sourceId: 'm1',
      path: 'memory/core.json#m1',
    });
  });

  it('indexes identity, conversations, and knowledge alongside memory', () => {
    const snap = buildSnapshot([{ id: 'm1', content: 'memory body widget' }], 'identity widget');
    snap.conversations = {
      total: 1,
      conversations: [
        {
          id: 'c1',
          title: 'conversation widget title',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          path: 'conversations/c1.json',
        },
      ],
    };
    snap.memory.knowledge = [
      {
        id: 'k1',
        filename: 'widget-guide.md',
        mimeType: 'text/markdown',
        path: 'memory/knowledge/widget-guide.md',
        size: 0,
        checksum: '',
      },
    ];
    const idx = buildSearchIndex(snap);
    const widgetPostings = idx.tokens['widget'];
    expect(widgetPostings).toBeDefined();
    const types = widgetPostings.map((p) => p.type).sort();
    expect(types).toEqual(['conversation', 'identity', 'knowledge', 'memory']);
  });
});

describe('tokenize', () => {
  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('drops single-character tokens', () => {
    expect(tokenize('a bb c dd')).toEqual(['bb', 'dd']);
  });
});

describe('end-to-end: index parity with brute-force scan', () => {
  let testDir: string;
  let storage: LocalStorageBackend;
  let config: SaveStateConfig;

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-search-index-${Date.now()}-${randomBytes(4).toString('hex')}`);
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

  it('packs search/index.json into the SAF and round-trips it through unpack', async () => {
    const snap = buildSnapshot([
      { id: 'm1', content: 'User loves Italian food and cocktails' },
    ]);
    await createSnapshot(new FakeAdapter(snap), storage, PASSPHRASE);

    const indexFile = await import('../index-file.js');
    const entry = (await indexFile.loadIndex()).snapshots[0];
    const archive = await decrypt(await storage.get(entry.filename), PASSPHRASE);
    const files = await unpackFromArchive(archive);
    expect(files.has('search/index.json')).toBe(true);

    const restored = unpackSnapshot(files);
    expect(restored.searchIndex).toBeDefined();
    expect(restored.searchIndex!.tokens['cocktails']).toBeDefined();
    expect(restored.searchIndex!.tokens['cocktails'][0]).toEqual({
      type: 'memory',
      sourceId: 'm1',
      path: 'memory/core.json#m1',
    });
  });

  it('legacy snapshot (no search index) still returns correct results', async () => {
    // Build a snapshot, save it, then mutate the cached unpacked snapshot
    // to simulate a legacy archive. We do this by reading back the archive,
    // removing search/index.json, repacking, re-encrypting, and overwriting.
    const snap = buildSnapshot([
      { id: 'm1', content: 'legacy widget content' },
      { id: 'm2', content: 'no match here' },
    ]);
    const adapter = new FakeAdapter(snap);
    await createSnapshot(adapter, storage, PASSPHRASE);

    const indexFile = await import('../index-file.js');
    const idx = await indexFile.loadIndex();
    const entry = idx.snapshots[0];

    // Read, decrypt, strip search/index.json, re-pack, re-encrypt, overwrite
    const { encrypt } = await import('../encryption.js');
    const { packToArchive, computeContentChecksum } = await import('../format.js');
    const encrypted = await storage.get(entry.filename);
    const archive = await decrypt(encrypted, PASSPHRASE);
    const files = await unpackFromArchive(archive);
    files.delete('search/index.json');
    // Recompute checksum so doctor stays green for this test snapshot
    const snapshot = unpackSnapshot(files);
    snapshot.manifest.checksum = computeContentChecksum(files);
    files.set('manifest.json', Buffer.from(JSON.stringify(snapshot.manifest, null, 2)));
    const newArchive = packToArchive(files);
    const newEncrypted = await encrypt(newArchive, PASSPHRASE);
    await storage.put(entry.filename, newEncrypted);

    clearSnapshotCache();
    const results = await searchSnapshots('widget', config, { passphrase: PASSPHRASE });
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('widget');
  });

  it('snapshot WITH search index returns the same results as the legacy fallback for identical content', async () => {
    // Build identical snapshots, force one to use a legacy archive layout
    // by stripping search/index.json. Compare results.
    const memories = [
      { id: 'a', content: 'apple banana cherry' },
      { id: 'b', content: 'banana cherry date' },
      { id: 'c', content: 'totally unrelated' },
    ];

    // Snapshot 1: indexed (default)
    const snap1 = buildSnapshot(memories);
    await createSnapshot(new FakeAdapter(snap1), storage, PASSPHRASE);

    clearSnapshotCache();
    const withIndex = await searchSnapshots('banana', config, { passphrase: PASSPHRASE });

    // Now strip the index from the on-disk archive and re-run
    const indexFile = await import('../index-file.js');
    const idx = await indexFile.loadIndex();
    const entry = idx.snapshots[0];
    const { encrypt } = await import('../encryption.js');
    const { packToArchive, computeContentChecksum } = await import('../format.js');
    const archive = await decrypt(await storage.get(entry.filename), PASSPHRASE);
    const files = await unpackFromArchive(archive);
    files.delete('search/index.json');
    const snapshot = unpackSnapshot(files);
    snapshot.manifest.checksum = computeContentChecksum(files);
    files.set('manifest.json', Buffer.from(JSON.stringify(snapshot.manifest, null, 2)));
    await storage.put(entry.filename, await encrypt(packToArchive(files), PASSPHRASE));

    clearSnapshotCache();
    const withoutIndex = await searchSnapshots('banana', config, { passphrase: PASSPHRASE });

    // Both paths must produce the same content set (snapshotIds may differ
    // because the legacy snapshot still has the same id, so this should be
    // a strict equality check).
    expect(withoutIndex).toEqual(withIndex);
    expect(withIndex.length).toBe(2);
  });
});
