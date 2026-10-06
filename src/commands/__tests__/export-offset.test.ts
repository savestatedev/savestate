import { describe, expect, it } from 'vitest';
import {
  applyExportFilters,
  parseExportOffset,
  selectExportOffsetEntries,
} from '../container.js';

describe('savestate export --offset', () => {
  it('defaults to undefined', () => {
    expect(parseExportOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseExportOffset('0')).toBe(0);
    expect(parseExportOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseExportOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseExportOffset('1000')).toBe(1000);
    expect(() => parseExportOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N packed components', () => {
    expect(
      selectExportOffsetEntries(
        ['memory', 'personality', 'tools'],
        1,
      ),
    ).toEqual(['personality', 'tools']);
  });

  it('returns all components when offset is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectExportOffsetEntries(components, undefined)).toEqual(components);
  });

  it('skips packed components before --limit', () => {
    expect(
      applyExportFilters(
        ['memory', 'personality', 'tools'],
        { offset: '1', limit: '1' },
      ),
    ).toEqual(['personality']);
  });
});
