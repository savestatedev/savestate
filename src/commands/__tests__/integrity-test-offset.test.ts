import { describe, expect, it } from 'vitest';
import {
  parseIntegrityTestOffset,
  selectIntegrityTestPage,
} from '../integrity.js';

describe('savestate integrity test --offset', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityTestOffset(undefined)).toBeUndefined();
  });

  it('accepts bounded non-negative integers', () => {
    expect(parseIntegrityTestOffset('0')).toBe(0);
    expect(parseIntegrityTestOffset('12')).toBe(12);
    expect(parseIntegrityTestOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', 'nope', '1001'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityTestOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('skips before applying the event limit', () => {
    expect(
      selectIntegrityTestPage(
        [{ id: 'evt-1' }, { id: 'evt-2' }, { id: 'evt-3' }, { id: 'evt-4' }],
        1,
        2,
      ).map((entry) => entry.id),
    ).toEqual(['evt-2', 'evt-3']);
  });
});
