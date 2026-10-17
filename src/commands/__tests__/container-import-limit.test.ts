import { describe, expect, it } from 'vitest';
import {
  parseContainerImportLimit,
  parseImportOffset,
  selectContainerImportComponents,
  selectImportOffsetEntries,
} from '../container.js';

describe('savestate container import --limit', () => {
  it('defaults to undefined', () => {
    expect(parseContainerImportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseContainerImportLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContainerImportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseContainerImportLimit('1000')).toBe(1000);
    expect(() => parseContainerImportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N packed components', () => {
    expect(
      selectContainerImportComponents(
        ['memory', 'personality', 'tools'],
        2,
      ),
    ).toEqual(['memory', 'personality']);
  });

  it('returns all components when --limit is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectContainerImportComponents(components, undefined)).toEqual(components);
  });

  it('supports bounded offsets before applying the limit', () => {
    expect(parseImportOffset(' 1 ')).toBe(1);
    expect(
      selectContainerImportComponents(
        selectImportOffsetEntries(['memory', 'personality', 'tools'], 1),
        1,
      ),
    ).toEqual(['personality']);
  });

  it.each(['-1', '1.5', '1001', 'nope'])('rejects invalid offsets %s', (value) => {
    expect(() => parseImportOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });
});
