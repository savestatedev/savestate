/**
 * Tests for planPrune — pure planner for retention.
 */

import { describe, it, expect } from 'vitest';
import { planPrune } from '../commands/prune.js';
import type { SnapshotIndexEntry } from '../index-file.js';

function entry(partial: Partial<SnapshotIndexEntry>): SnapshotIndexEntry {
  return {
    id: partial.id ?? 'ss-x',
    timestamp: partial.timestamp ?? '2026-01-01T00:00:00Z',
    platform: partial.platform ?? 'claude',
    adapter: partial.adapter ?? 'claude-code',
    filename: partial.filename ?? `${partial.id ?? 'ss-x'}.saf.enc`,
    size: partial.size ?? 1024,
  };
}

describe('planPrune', () => {
  const ten = Array.from({ length: 10 }, (_, i) =>
    entry({
      id: `s${i}`,
      timestamp: `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      adapter: 'claude-code',
    }),
  );

  it('--keep-last keeps the N newest, drops the rest', () => {
    const plan = planPrune(ten, { keepLast: 3 });
    expect(plan.keep.map((s) => s.id).sort()).toEqual(['s7', 's8', 's9']);
    expect(plan.drop.map((s) => s.id)).toContain('s0');
    expect(plan.drop.length).toBe(7);
  });

  it('--older-than drops anything below the cutoff', () => {
    const cutoff = new Date('2026-04-05T00:00:00Z').getTime();
    const plan = planPrune(ten, { olderThanMs: cutoff });
    for (const dropped of plan.drop) {
      expect(new Date(dropped.timestamp).getTime()).toBeLessThan(cutoff);
    }
    for (const kept of plan.keep) {
      expect(new Date(kept.timestamp).getTime()).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it('never drops the newest snapshot, even if rules would', () => {
    const cutoff = Date.now() + 1000 * 60 * 60 * 24 * 365; // far future
    const plan = planPrune(ten, { olderThanMs: cutoff });
    const newest = ten.reduce((a, b) =>
      new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b,
    );
    expect(plan.keep.map((s) => s.id)).toContain(newest.id);
  });

  it('protects sole snapshots for an adapter', () => {
    const mixed = [
      ...ten,
      entry({
        id: 'gem-1',
        timestamp: '2026-01-01T00:00:00Z',
        adapter: 'gemini',
      }),
    ];
    const cutoff = new Date('2026-04-05T00:00:00Z').getTime();
    const plan = planPrune(mixed, { olderThanMs: cutoff });
    expect(plan.keep.map((s) => s.id)).toContain('gem-1');
    expect(plan.kept_for_chain_safety.map((s) => s.id)).toContain('gem-1');
  });

  it('combines --keep-last with --older-than', () => {
    const cutoff = new Date('2026-04-08T00:00:00Z').getTime();
    const plan = planPrune(ten, { keepLast: 2, olderThanMs: cutoff });
    expect(plan.keep.length).toBeGreaterThanOrEqual(2);
    for (const dropped of plan.drop) {
      expect(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']).toContain(dropped.id);
    }
  });
});
