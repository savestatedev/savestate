import { describe, expect, it } from 'vitest';
import {
  applyAntibodiesStatsFilters,
  parseAntibodiesStatsOffset,
  selectAntibodiesStatsOffsetEntries,
} from '../antibodies.js';

describe('savestate antibodies stats --offset', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesStatsOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseAntibodiesStatsOffset('0')).toBe(0);
    expect(parseAntibodiesStatsOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesStatsOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseAntibodiesStatsOffset('1000')).toBe(1000);
    expect(() => parseAntibodiesStatsOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N stats rules', () => {
    expect(
      selectAntibodiesStatsOffsetEntries(
        [{ id: 'ab-write' }, { id: 'ab-retry' }, { id: 'ab-probe' }],
        1,
      ).map((rule) => rule.id),
    ).toEqual(['ab-retry', 'ab-probe']);
  });

  it('returns all rules when offset is omitted', () => {
    const rules = [{ id: 'ab-write' }, { id: 'ab-retry' }];
    expect(selectAntibodiesStatsOffsetEntries(rules, undefined)).toEqual(rules);
  });

  it('skips rules before --limit', () => {
    expect(
      applyAntibodiesStatsFilters(
        [{ id: 'ab-write' }, { id: 'ab-retry' }, { id: 'ab-probe' }],
        { offset: '1', limit: '1' },
      ).map((rule) => rule.id),
    ).toEqual(['ab-retry']);
  });
});
