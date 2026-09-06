import { describe, expect, it } from 'vitest';
import {
  formatMemoryApplyPoliciesJson,
  type MemoryApplyPoliciesJson,
  type TierChange,
} from '../memory.js';

describe('savestate memory apply-policies --json', () => {
  it('prints from/to tiers as JSON', () => {
    const changes: TierChange[] = [
      { entryId: 'mem-123', from: 'L1', to: 'L2', reason: 'age' },
    ];
    const parsed = JSON.parse(formatMemoryApplyPoliciesJson(changes)) as MemoryApplyPoliciesJson & {
      entryId?: unknown;
      previousContent?: unknown;
    };
    expect(parsed).toEqual({
      dryRun: false,
      applied: true,
      changeCount: 1,
      changes: [{ id: 'mem-123', from: 'L1', to: 'L2', reason: 'age' }],
    });
    expect(parsed.entryId).toBeUndefined();
    expect(parsed.previousContent).toBeUndefined();
  });

  it('records a dry run without applying', () => {
    const changes: TierChange[] = [
      { entryId: 'mem-456', from: 'L2', to: 'L3', reason: 'age' },
    ];
    const parsed = JSON.parse(
      formatMemoryApplyPoliciesJson(changes, { dryRun: true }),
    ) as MemoryApplyPoliciesJson;
    expect(parsed.dryRun).toBe(true);
    expect(parsed.applied).toBe(false);
    expect(parsed.changeCount).toBe(1);
    expect(parsed.changes[0]).toEqual({
      id: 'mem-456',
      from: 'L2',
      to: 'L3',
      reason: 'age',
    });
  });

  it('records no changes as an empty list', () => {
    const parsed = JSON.parse(formatMemoryApplyPoliciesJson([])) as MemoryApplyPoliciesJson;
    expect(parsed).toEqual({
      dryRun: false,
      applied: false,
      changeCount: 0,
      changes: [],
    });
  });
});
