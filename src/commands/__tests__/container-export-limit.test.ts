import { describe, expect, it } from 'vitest';
import { parseContainerExportLimit, selectContainerExportComponents } from '../container.js';

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
