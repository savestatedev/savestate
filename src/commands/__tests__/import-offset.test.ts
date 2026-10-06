import { describe, expect, it } from 'vitest';
import {
  applyImportFilters,
  parseImportOffset,
  selectImportOffsetEntries,
} from '../container.js';

describe('savestate import --offset', () => {
  it('defaults to undefined', () => {
    expect(parseImportOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseImportOffset('0')).toBe(0);
    expect(parseImportOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseImportOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseImportOffset('1000')).toBe(1000);
    expect(() => parseImportOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N packed components', () => {
    expect(
      selectImportOffsetEntries(
        ['memory', 'personality', 'tools'],
        1,
      ),
    ).toEqual(['personality', 'tools']);
  });

  it('returns all components when offset is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectImportOffsetEntries(components, undefined)).toEqual(components);
  });

  it('skips packed components before --limit', () => {
    expect(
      applyImportFilters(
        ['memory', 'personality', 'tools'],
        { offset: '1', limit: '1' },
      ),
    ).toEqual(['personality']);
  });
});
