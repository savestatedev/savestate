import { describe, expect, it } from 'vitest';
import { parseImportLimit, selectImportComponents } from '../container.js';

describe('savestate import --limit', () => {
  it('defaults to undefined', () => {
    expect(parseImportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseImportLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseImportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseImportLimit('1000')).toBe(1000);
    expect(() => parseImportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N packed components', () => {
    expect(
      selectImportComponents(
        ['memory', 'personality', 'tools'],
        2,
      ),
    ).toEqual(['memory', 'personality']);
  });

  it('returns all components when --limit is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectImportComponents(components, undefined)).toEqual(components);
  });
});
