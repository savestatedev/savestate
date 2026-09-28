import { describe, expect, it } from 'vitest';
import { parseAntibodiesStatsLimit, selectAntibodiesStatsRules } from '../antibodies.js';

describe('savestate antibodies stats --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesStatsLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAntibodiesStatsLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesStatsLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAntibodiesStatsLimit('1000')).toBe(1000);
    expect(() => parseAntibodiesStatsLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N stats rules', () => {
    expect(
      selectAntibodiesStatsRules(
        [{ id: 'ab-write' }, { id: 'ab-retry' }, { id: 'ab-probe' }],
        2,
      ).map((rule) => rule.id),
    ).toEqual(['ab-write', 'ab-retry']);
  });

  it('returns all rules when --limit is omitted', () => {
    const rules = [{ id: 'ab-write' }, { id: 'ab-retry' }];
    expect(selectAntibodiesStatsRules(rules, undefined)).toEqual(rules);
  });
});
