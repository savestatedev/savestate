import { describe, expect, it } from 'vitest';
import { parseSloStatusLimit, selectSloStatusViolations } from '../slo.js';

describe('savestate slo status --limit', () => {
  it('defaults to undefined', () => {
    expect(parseSloStatusLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSloStatusLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSloStatusLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSloStatusLimit('1000')).toBe(1000);
    expect(() => parseSloStatusLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status violations', () => {
    expect(
      selectSloStatusViolations(
        [{ id: 'freshness' }, { id: 'relevance' }, { id: 'recall' }],
        2,
      ).map((violation) => violation.id),
    ).toEqual(['freshness', 'relevance']);
  });

  it('returns all violations when --limit is omitted', () => {
    const violations = [{ id: 'freshness' }, { id: 'relevance' }];
    expect(selectSloStatusViolations(violations, undefined)).toEqual(violations);
  });
});
