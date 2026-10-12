import { describe, expect, it } from 'vitest';
import { parseIntegrityOffset, selectIntegrityIncidentPage } from '../integrity.js';

describe('savestate integrity incidents --offset', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityOffset(undefined)).toBeUndefined();
  });

  it('accepts bounded non-negative integers', () => {
    expect(parseIntegrityOffset('0')).toBe(0);
    expect(parseIntegrityOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', '1001', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('skips before applying the limit', () => {
    expect(
      selectIntegrityIncidentPage(
        [{ id: 'inc-1' }, { id: 'inc-2' }, { id: 'inc-3' }],
        1,
        1,
      ).map((incident) => incident.id),
    ).toEqual(['inc-2']);
  });
});
