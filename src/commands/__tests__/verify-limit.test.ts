import { describe, expect, it } from 'vitest';
import { parseVerifyLimit, selectVerifyComponents } from '../verify.js';

describe('savestate verify --limit', () => {
  it('defaults to undefined', () => {
    expect(parseVerifyLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseVerifyLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseVerifyLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseVerifyLimit('1000')).toBe(1000);
    expect(() => parseVerifyLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N packed components', () => {
    expect(
      selectVerifyComponents(
        ['memory', 'personality', 'tools'],
        2,
      ),
    ).toEqual(['memory', 'personality']);
  });

  it('returns all components when --limit is omitted', () => {
    const components = ['memory', 'tools'];
    expect(selectVerifyComponents(components, undefined)).toEqual(components);
  });
});
