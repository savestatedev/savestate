import { describe, expect, it } from 'vitest';
import { parseContainerImportLimit, selectContainerImportComponents } from '../container.js';

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
});
