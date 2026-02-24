/**
 * Failure Antibody store tests
 */

import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AntibodyStore } from '../store.js';
import type { AntibodyRule } from '../types.js';

describe('AntibodyStore', () => {
  let workDir: string;
  let store: AntibodyStore;

  beforeEach(async () => {
    workDir = join(
      tmpdir(),
      `savestate-antibody-store-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(workDir, { recursive: true });
    store = new AntibodyStore(workDir);
  });

  afterEach(async () => {
    if (existsSync(workDir)) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('loads empty store when file does not exist', async () => {
    const loaded = await store.load();
    expect(loaded.version).toBe(1);
    expect(loaded.rules).toEqual([]);
  });

  it('adds and lists rules', async () => {
    const rule = createRule('ab_test_1');
    await store.add(rule);

    const allRules = await store.list();
    const activeRules = await store.list({ activeOnly: true });

    expect(allRules).toHaveLength(1);
    expect(activeRules).toHaveLength(1);
    expect(allRules[0].id).toBe('ab_test_1');
  });

  it('retires rules and excludes them from active listing', async () => {
    await store.add(createRule('ab_test_2'));
    const retired = await store.retire('ab_test_2');

    expect(retired).toBe(true);

    const allRules = await store.list();
    const activeRules = await store.list({ activeOnly: true });

    expect(allRules).toHaveLength(1);
    expect(allRules[0].retired_at).toBeDefined();
    expect(activeRules).toHaveLength(0);
  });

  it('tracks hit and override counters in stats', async () => {
    await store.add(createRule('ab_test_3'));

    await store.recordHit('ab_test_3');
    await store.recordHit('ab_test_3');
    await store.recordOverride('ab_test_3');

    const stats = await store.stats();

    expect(stats.total_hits).toBe(2);
    expect(stats.total_overrides).toBe(1);
    expect(stats.rules).toHaveLength(1);
    expect(stats.rules[0].hits).toBe(2);
    expect(stats.rules[0].overrides).toBe(1);
  });
});

function createRule(id: string): AntibodyRule {
  return {
    id,
    trigger: {
      tool: 'filesystem',
      error_codes: ['EACCES'],
      path_prefixes: ['/tmp'],
      tags: ['write'],
    },
    risk: 'high',
    safe_action: { type: 'check_permissions' },
    scope: { project: 'local' },
    confidence: 0.88,
    intervention: 'warn',
    created_at: new Date('2026-02-20T00:00:00.000Z').toISOString(),
    source_event_ids: [],
    hits: 0,
    overrides: 0,
  };
}

