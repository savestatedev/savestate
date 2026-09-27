import { describe, expect, it } from 'vitest';
import { parseIntegrityLimit, selectIntegrityIncidents } from '../integrity.js';

describe('savestate integrity incidents --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityLimit('1000')).toBe(1000);
    expect(() => parseIntegrityLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N incidents', () => {
    expect(
      selectIntegrityIncidents(
        [{ id: 'inc-open' }, { id: 'inc-contained' }, { id: 'inc-resolved' }],
        2,
      ).map((incident) => incident.id),
    ).toEqual(['inc-open', 'inc-contained']);
  });

  it('returns all incidents when --limit is omitted', () => {
    const incidents = [{ id: 'inc-open' }, { id: 'inc-contained' }];
    expect(selectIntegrityIncidents(incidents, undefined)).toEqual(incidents);
  });

  it('ANDs --status results with --limit', () => {
    expect(
      selectIntegrityIncidents(
        [{ id: 'inc-open' }, { id: 'inc-open-2' }, { id: 'inc-open-3' }],
        parseIntegrityLimit('2'),
      ).map((incident) => incident.id),
    ).toEqual(['inc-open', 'inc-open-2']);
  });
});
