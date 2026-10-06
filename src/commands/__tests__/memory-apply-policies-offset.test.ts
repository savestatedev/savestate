import { describe, expect, it } from 'vitest';
import {
  applyMemoryApplyPoliciesFilters,
  parseMemoryApplyPoliciesOffset,
  selectMemoryApplyPoliciesOffsetChanges,
} from '../memory.js';

describe('savestate memory apply-policies --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryApplyPoliciesOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryApplyPoliciesOffset('0')).toBe(0);
    expect(parseMemoryApplyPoliciesOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryApplyPoliciesOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryApplyPoliciesOffset('1000')).toBe(1000);
    expect(() => parseMemoryApplyPoliciesOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N tier changes', () => {
    expect(
      selectMemoryApplyPoliciesOffsetChanges(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        1,
      ).map((change) => change.id),
    ).toEqual(['mem-2', 'mem-3']);
  });

  it('returns all changes when offset is omitted', () => {
    const changes = [{ id: 'mem-1' }, { id: 'mem-2' }];
    expect(selectMemoryApplyPoliciesOffsetChanges(changes, undefined)).toEqual(changes);
  });

  it('skips tier changes before --limit', () => {
    expect(
      applyMemoryApplyPoliciesFilters(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        { offset: '1', limit: '1' },
      ).map((change) => change.id),
    ).toEqual(['mem-2']);
  });
});
