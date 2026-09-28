import { describe, expect, it } from 'vitest';
import { parseMemoryApplyPoliciesLimit, selectMemoryApplyPoliciesChanges } from '../memory.js';

describe('savestate memory apply-policies --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryApplyPoliciesLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryApplyPoliciesLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryApplyPoliciesLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryApplyPoliciesLimit('1000')).toBe(1000);
    expect(() => parseMemoryApplyPoliciesLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N tier changes', () => {
    expect(
      selectMemoryApplyPoliciesChanges(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        2,
      ).map((change) => change.id),
    ).toEqual(['mem-1', 'mem-2']);
  });

  it('returns all changes when --limit is omitted', () => {
    const changes = [{ id: 'mem-1' }, { id: 'mem-2' }];
    expect(selectMemoryApplyPoliciesChanges(changes, undefined)).toEqual(changes);
  });
});
