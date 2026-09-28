import { describe, expect, it } from 'vitest';
import { parseAntibodiesPreflightLimit, selectAntibodiesPreflightWarnings } from '../antibodies.js';

describe('savestate antibodies preflight --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesPreflightLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAntibodiesPreflightLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesPreflightLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAntibodiesPreflightLimit('1000')).toBe(1000);
    expect(() => parseAntibodiesPreflightLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N preflight warnings', () => {
    expect(
      selectAntibodiesPreflightWarnings(
        [{ ruleId: 'ab-write' }, { ruleId: 'ab-retry' }, { ruleId: 'ab-probe' }],
        2,
      ).map((warning) => warning.ruleId),
    ).toEqual(['ab-write', 'ab-retry']);
  });

  it('returns all warnings when --limit is omitted', () => {
    const warnings = [{ ruleId: 'ab-write' }, { ruleId: 'ab-retry' }];
    expect(selectAntibodiesPreflightWarnings(warnings, undefined)).toEqual(warnings);
  });
});
