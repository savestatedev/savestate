import { describe, expect, it } from 'vitest';
import {
  applyTeamStatusFilters,
  parseTeamStatusOffset,
  selectTeamStatusOffsetEntries,
} from '../team.js';

describe('savestate team status --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTeamStatusOffset(undefined)).toBeUndefined();
  });

  it('accepts bounded non-negative integers', () => {
    expect(parseTeamStatusOffset('0')).toBe(0);
    expect(parseTeamStatusOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', 'nope', '1001'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamStatusOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('skips status rows before applying the limit', () => {
    expect(
      applyTeamStatusFilters(
        [{ id: 'team' }, { id: 'id' }, { id: 'role' }, { id: 'created' }],
        { offset: '1', limit: '2' },
      ).map((entry) => entry.id),
    ).toEqual(['id', 'role']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'team' }, { id: 'id' }];
    expect(selectTeamStatusOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
