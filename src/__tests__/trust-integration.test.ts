/**
 * Tests for the Trust Kernel ↔ MemoryStore integration (Phase 2).
 *
 * MemoryStore.create() now optionally routes through a WriteGate. Denylisted
 * content is rejected with a typed exception and never reaches SQLite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { MemoryStore, TrustGateRejection } from '../memory/store.js';
import { TrustStore } from '../trust-kernel/store.js';
import { WriteGate } from '../trust-kernel/gates.js';

describe('MemoryStore + Trust Kernel WriteGate', () => {
  let tmp: string;
  let memDb: string;
  let trustDb: string;
  let trustStore: TrustStore;

  beforeEach(async () => {
    tmp = join(tmpdir(), `savestate-trust-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(tmp, { recursive: true });
    memDb = join(tmp, 'memory.db');
    trustDb = join(tmp, 'trust.db');
    trustStore = new TrustStore({ dbPath: trustDb });
  });

  afterEach(async () => {
    trustStore.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('allows writes that pass the gate', async () => {
    const gate = new WriteGate({ store: trustStore });
    const memory = new MemoryStore({ dbPath: memDb, writeGate: gate });

    const entry = await memory.create({
      type: 'fact',
      content: 'User prefers dark mode',
    });
    expect(entry.id).toBeDefined();
    expect(entry.content).toBe('User prefers dark mode');

    const all = await memory.query({});
    expect(all).toHaveLength(1);
  });

  it('rejects denylisted content with TrustGateRejection', async () => {
    trustStore.addToDenylist('forbidden phrase', 'test denylist', 'test');
    const gate = new WriteGate({ store: trustStore });
    const memory = new MemoryStore({ dbPath: memDb, writeGate: gate });

    await expect(
      memory.create({
        type: 'fact',
        content: 'this contains a forbidden phrase here',
      }),
    ).rejects.toBeInstanceOf(TrustGateRejection);

    const all = await memory.query({});
    expect(all).toHaveLength(0);
  });

  it('still works without a writeGate (opt-in only)', async () => {
    const memory = new MemoryStore({ dbPath: memDb });
    const entry = await memory.create({ type: 'fact', content: 'no gate here' });
    expect(entry.id).toBeDefined();
  });

  it('records the rejection blockers list on the thrown error', async () => {
    trustStore.addToDenylist('badword', 'test', 'test');
    const gate = new WriteGate({ store: trustStore });
    const memory = new MemoryStore({ dbPath: memDb, writeGate: gate });

    try {
      await memory.create({ type: 'fact', content: 'contains badword in body' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TrustGateRejection);
      const rejection = err as TrustGateRejection;
      expect(rejection.blockers.length).toBeGreaterThan(0);
      expect(rejection.blockers[0]).toMatch(/Denylisted/i);
    }
  });
});

describe('TrustStore.getRecentTransitions', () => {
  let tmp: string;
  let trustStore: TrustStore;

  beforeEach(async () => {
    tmp = join(tmpdir(), `savestate-trust-audit-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(tmp, { recursive: true });
    trustStore = new TrustStore({ dbPath: join(tmp, 'trust.db') });
  });

  afterEach(async () => {
    trustStore.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns empty when no transitions have happened', () => {
    expect(trustStore.getRecentTransitions()).toEqual([]);
  });

  it('returns transitions newest-first after a state change', () => {
    const entry = trustStore.create({
      content: 'sample content',
      scope: 'semantic',
      confidence: 0.9,
      source: 'test',
    });
    trustStore.transition(entry.id, 'stable', 'promotion test', 'test-actor');
    trustStore.transition(entry.id, 'revoked', 'revoke test', 'test-actor');

    const events = trustStore.getRecentTransitions(10);
    expect(events.length).toBe(2);
    expect(events[0].toState).toBe('revoked');
    expect(events[1].toState).toBe('stable');
  });
});
