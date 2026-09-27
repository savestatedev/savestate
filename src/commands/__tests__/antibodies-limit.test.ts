import { describe, expect, it } from 'vitest';
import { applyAntibodiesLimit, parseAntibodiesLimit } from '../antibodies.js';

describe('savestate antibodies --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAntibodiesLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAntibodiesLimit('1000')).toBe(1000);
    expect(() => parseAntibodiesLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N rules', () => {
    expect(
      applyAntibodiesLimit(
        [{ id: 'ab-write' }, { id: 'ab-retry' }, { id: 'ab-probe' }],
        2,
      ).map((rule) => rule.id),
    ).toEqual(['ab-write', 'ab-retry']);
  });

  it('returns all rules when --limit is omitted', () => {
    const rules = [{ id: 'ab-write' }, { id: 'ab-retry' }];
    expect(applyAntibodiesLimit(rules, undefined)).toEqual(rules);
  });

  it('ANDs --all results with --limit', () => {
    expect(
      applyAntibodiesLimit(
        [{ id: 'active' }, { id: 'retired' }, { id: 'extra' }],
        parseAntibodiesLimit('2'),
      ).map((rule) => rule.id),
    ).toEqual(['active', 'retired']);
  });
});
