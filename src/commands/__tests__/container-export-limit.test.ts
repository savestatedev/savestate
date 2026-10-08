import { describe, expect, it } from 'vitest';
import {
  parseContainerExportLimit,
  parseContainerExportOffset,
  applyExportFilters,
  selectContainerExportComponents,
} from '../container.js';

describe('savestate container export --limit', () => {
  it('defaults to undefined', () => {
    expect(parseContainerExportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseContainerExportLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContainerExportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseContainerExportLimit('1000')).toBe(1000);
    expect(() => parseContainerExportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N packed components', () => {
    expect(
      selectContainerExportComponents(
        ['memory', 'personality', 'tools'],
        2,
      ),
    ).toEqual(['memory', 'personality']);
  });

  it('returns all components when --limit is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectContainerExportComponents(components, undefined)).toEqual(components);
  });
});

describe('savestate container export --offset', () => {
  it('defaults to undefined', () => {
    expect(parseContainerExportOffset(undefined)).toBeUndefined();
  });

  it('accepts non-negative integers', () => {
    expect(parseContainerExportOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContainerExportOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('skips before applying the limit', () => {
    expect(
      applyExportFilters(
        ['memory', 'personality', 'tools'],
        { offset: '1', limit: '1' },
      ),
    ).toEqual(['personality']);
  });
});
