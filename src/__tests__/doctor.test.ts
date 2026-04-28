/**
 * Tests for diagnoseSnapshot — health check on a single snapshot.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { LocalStorageBackend } from '../storage/local.js';
import { createSnapshot } from '../snapshot.js';
import { diagnoseSnapshot } from '../commands/doctor.js';
import { loadIndex } from '../index-file.js';
import type { Adapter, Snapshot } from '../types.js';

const PASSPHRASE = 'doctor-test-passphrase-12345';

function buildSnapshot(): Snapshot {
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
    identity: { personality: 'test personality' },
    memory: {
      core: [{ id: 'm1', content: 'hello', source: 'test', createdAt: new Date().toISOString() }],
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

describe('diagnoseSnapshot', () => {
  let testDir: string;
  let storage: LocalStorageBackend;

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-doctor-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    storage = new LocalStorageBackend({ path: join(testDir, 'snapshots') });
  });

  afterEach(async () => {
    process.chdir(tmpdir());
    await rm(testDir, { recursive: true, force: true });
  });

  it('reports healthy for a freshly created snapshot with content checksum', async () => {
    const adapter = new FakeAdapter(buildSnapshot());
    await createSnapshot(adapter, storage, PASSPHRASE);
    const index = await loadIndex();
    const diag = await diagnoseSnapshot(index.snapshots[0], storage, PASSPHRASE);

    expect(diag.ok).toBe(true);
    expect(diag.errors).toEqual([]);
    expect(diag.warnings).toEqual([]);
  });

  it('flags decrypt failure with the wrong passphrase', async () => {
    const adapter = new FakeAdapter(buildSnapshot());
    await createSnapshot(adapter, storage, PASSPHRASE);
    const index = await loadIndex();
    const diag = await diagnoseSnapshot(index.snapshots[0], storage, 'wrong-passphrase');

    expect(diag.ok).toBe(false);
    expect(diag.errors.length).toBeGreaterThan(0);
    expect(diag.errors[0]).toMatch(/decrypt/i);
  });

  it('flags missing file as storage error', async () => {
    const adapter = new FakeAdapter(buildSnapshot());
    await createSnapshot(adapter, storage, PASSPHRASE);
    const index = await loadIndex();
    const fake = { ...index.snapshots[0], filename: 'does-not-exist.saf.enc' };
    const diag = await diagnoseSnapshot(fake, storage, PASSPHRASE);

    expect(diag.ok).toBe(false);
    expect(diag.errors[0]).toMatch(/storage read failed/);
  });
});
