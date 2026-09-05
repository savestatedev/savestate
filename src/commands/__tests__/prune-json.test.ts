import { describe, expect, it } from 'vitest';
import { formatPruneJson, planPrune, type PruneJson } from '../prune.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

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

const ten = Array.from({ length: 10 }, (_, i) =>
  entry({
    id: `s${i}`,
    timestamp: `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    adapter: 'claude-code',
  }),
);

describe('savestate prune --json', () => {
  it('prints prune plan as JSON with dry-run counts', () => {
    const plan = planPrune(ten, { keepLast: 3 });
    const parsed = JSON.parse(formatPruneJson(plan, true)) as PruneJson;
    expect(parsed.dryRun).toBe(true);
    expect(parsed.keepCount).toBe(3);
    expect(parsed.dropCount).toBe(7);
    expect(parsed.keep.map((s) => s.id)).toEqual(['s9', 's8', 's7']);
    expect(parsed.drop[0]?.id).toBe('s6');
    expect(parsed.drop[0]?.filename).toBe('s6.saf.enc');
    expect(parsed.drop[0]?.size).toBe(1024);
    expect(parsed.reasons.s9).toContain('kept');
    expect(parsed.reasons.s0).toContain('outside last 3');
  });

  it('records apply as dryRun false and empty drop as []', () => {
    const newest = [entry({ id: 's-only', timestamp: '2026-04-10T00:00:00Z' })];
    const plan = planPrune(newest, { keepLast: 1 });
    const parsed = JSON.parse(formatPruneJson(plan, false)) as PruneJson;
    expect(parsed.dryRun).toBe(false);
    expect(parsed.keepCount).toBe(1);
    expect(parsed.dropCount).toBe(0);
    expect(parsed.drop).toEqual([]);
    expect(parsed.keptForChainSafety).toEqual([]);
    expect(parsed.keep[0]?.id).toBe('s-only');
  });
});
