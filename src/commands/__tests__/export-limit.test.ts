import { describe, expect, it } from 'vitest';
import { parseExportLimit, selectExportComponents } from '../container.js';

describe('savestate export --limit', () => {
  it('defaults to undefined', () => {
    expect(parseExportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseExportLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseExportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseExportLimit('1000')).toBe(1000);
    expect(() => parseExportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N packed components', () => {
    expect(
      selectExportComponents(
        ['memory', 'personality', 'tools'],
        2,
      ),
    ).toEqual(['memory', 'personality']);
  });

  it('returns all components when --limit is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectExportComponents(components, undefined)).toEqual(components);
  });
});
