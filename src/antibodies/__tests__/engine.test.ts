/**
 * Failure Antibody preflight engine tests
 */

import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AntibodyEngine } from '../engine.js';
import { AntibodyStore } from '../store.js';
import type { AntibodyRule } from '../types.js';

describe('AntibodyEngine', () => {
  let workDir: string;
  let store: AntibodyStore;

  beforeEach(async () => {
    workDir = join(
      tmpdir(),
      `savestate-antibody-engine-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(workDir, { recursive: true });
    store = new AntibodyStore(workDir);
  });

  afterEach(async () => {
    if (existsSync(workDir)) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('matches rules using cheap matchers (tool/error/path/tag)', async () => {
    await store.add(
      createRule('ab_rule_match', {
        tool: 'filesystem',
        error_codes: ['EACCES'],
        path_prefixes: ['/workspace/app'],
        tags: ['write'],
      }),
    );

    const engine = new AntibodyEngine(store);
    const result = await engine.preflight({
      tool: 'filesystem',
      error_code: 'EACCES',
      path: '/workspace/app/config.json',
      tags: ['write', 'critical'],
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule_id).toBe('ab_rule_match');
    expect(result.warnings[0].reason_codes).toEqual(['tool', 'error_code', 'path_prefix', 'tag']);
    expect(result.semantic_used).toBe(false);
  });

  it('does not match when required trigger dimensions are missing', async () => {
    await store.add(
      createRule('ab_rule_no_match', {
        tool: 'filesystem',
        error_codes: ['ENOENT'],
      }),
    );

    const engine = new AntibodyEngine(store);
    const result = await engine.preflight({
      tool: 'filesystem',
      error_code: 'EACCES',
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.matched_rule_ids).toEqual([]);
  });

  it('keeps p95 preflight latency under 40ms by default with cheap matchers only', async () => {
    for (let i = 0; i < 120; i++) {
      await store.add(
        createRule(`ab_bulk_${i}`, {
          tool: i % 2 === 0 ? 'filesystem' : 'network',
          error_codes: [i % 3 === 0 ? 'EACCES' : 'ENOENT'],
          path_prefixes: ['/workspace/app'],
          tags: ['bulk'],
        }),
      );
    }

    const engine = new AntibodyEngine(store);
    const latencies: number[] = [];

    for (let i = 0; i < 30; i++) {
      const result = await engine.preflight({
        tool: 'filesystem',
        error_code: 'EACCES',
        path: '/workspace/app/file.txt',
        tags: ['bulk'],
      });
      latencies.push(result.elapsed_ms);
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(40);
  });
});

function createRule(
  id: string,
  trigger: {
    tool?: string;
    error_codes?: string[];
    path_prefixes?: string[];
    tags?: string[];
  },
): AntibodyRule {
  return {
    id,
    trigger,
    risk: 'medium',
    safe_action: { type: 'validate_inputs' },
    scope: { project: 'local' },
    confidence: 0.7,
    intervention: 'warn',
    created_at: new Date('2026-02-20T00:00:00.000Z').toISOString(),
    source_event_ids: [],
    hits: 0,
    overrides: 0,
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

