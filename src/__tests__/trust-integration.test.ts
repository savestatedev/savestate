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

describe('WriteGate shadow mode', () => {
  let tmp: string;
  let trustStore: TrustStore;

  beforeEach(async () => {
    tmp = join(tmpdir(), `savestate-shadow-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(tmp, { recursive: true });
    trustStore = new TrustStore({ dbPath: join(tmp, 'trust.db') });
    trustStore.addToDenylist('forbidden', 'test', 'test');
  });

  afterEach(async () => {
    trustStore.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('forces allowed=true even on a would-be reject', () => {
    const observed: any[] = [];
    const gate = new WriteGate({
      store: trustStore,
      shadow: true,
      onShadowReject: (d) => observed.push(d),
    });

    const result = gate.evaluate({ content: 'this contains forbidden text', source: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.shadowBlockers?.length).toBeGreaterThan(0);
    expect(result.shadowBlockers?.[0]).toMatch(/Denylisted/i);
    expect(observed.length).toBe(1);
    expect(observed[0].source).toBe('test');
    expect(gate.getShadowRejectionCount()).toBe(1);
  });

  it('does not record clean writes as shadow rejections', () => {
    const gate = new WriteGate({ store: trustStore, shadow: true });
    const result = gate.evaluate({ content: 'totally fine content', source: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.shadowBlockers).toBeUndefined();
    expect(gate.getShadowRejectionCount()).toBe(0);
  });

  it('enforces (blocks writes) when shadow is false', () => {
    const gate = new WriteGate({ store: trustStore, shadow: false });
    const result = gate.evaluate({ content: 'forbidden body', source: 'test' });
    expect(result.allowed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.shadowBlockers).toBeUndefined();
  });

  it('isShadow() reflects the configured mode', () => {
    expect(new WriteGate({ store: trustStore, shadow: true }).isShadow()).toBe(true);
    expect(new WriteGate({ store: trustStore }).isShadow()).toBe(false);
  });
});

describe('TrustStore denylist management', () => {
  let tmp: string;
  let trustStore: TrustStore;

  beforeEach(async () => {
    tmp = join(tmpdir(), `savestate-denylist-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(tmp, { recursive: true });
    trustStore = new TrustStore({ dbPath: join(tmp, 'trust.db') });
  });

  afterEach(async () => {
    trustStore.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('listDenylist returns entries newest-epoch first', () => {
    trustStore.addToDenylist('first', 'reason1', 'tester');
    trustStore.addToDenylist('second', 'reason2', 'tester');
    const entries = trustStore.listDenylist();
    expect(entries.length).toBe(2);
    expect(entries[0].pattern).toBe('second');
    expect(entries[1].pattern).toBe('first');
    expect(entries[0].epoch).toBeGreaterThan(entries[1].epoch);
  });

  it('removeFromDenylist deletes an exact match and reports the count', () => {
    trustStore.addToDenylist('to-remove', 'reason', 'tester');
    expect(trustStore.removeFromDenylist('to-remove')).toBe(1);
    expect(trustStore.listDenylist().length).toBe(0);
  });

  it('removeFromDenylist returns 0 when no match', () => {
    expect(trustStore.removeFromDenylist('nope')).toBe(0);
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
