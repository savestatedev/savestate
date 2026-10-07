import { describe, expect, it } from 'vitest';
import {
  parseSloOffset,
  selectSloConfigEntries,
  selectSloReportNamespaces,
  selectSloStatusViolations,
} from '../slo.js';

describe('savestate slo --offset', () => {
  it('defaults to undefined and accepts zero', () => {
    expect(parseSloOffset(undefined)).toBeUndefined();
    expect(parseSloOffset('0')).toBe(0);
    expect(parseSloOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSloOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSloOffset('1000')).toBe(1000);
    expect(() => parseSloOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('pages report namespace rows before applying the limit', () => {
    expect(
      selectSloReportNamespaces([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 1, 1),
    ).toEqual([{ id: 'b' }]);
  });

  it('pages status violations and config rows without a limit', () => {
    expect(selectSloStatusViolations(['a', 'b', 'c'], undefined, 1)).toEqual(['b', 'c']);
    expect(selectSloConfigEntries(['a', 'b', 'c'], 1, 1)).toEqual(['b']);
  });
});
