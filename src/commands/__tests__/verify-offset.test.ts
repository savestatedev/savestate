import { describe, expect, it } from 'vitest';
import {
  applyVerifyFilters,
  parseVerifyOffset,
  selectVerifyOffsetEntries,
} from '../verify.js';

describe('savestate verify --offset', () => {
  it('defaults to undefined', () => {
    expect(parseVerifyOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseVerifyOffset('0')).toBe(0);
    expect(parseVerifyOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseVerifyOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseVerifyOffset('1000')).toBe(1000);
    expect(() => parseVerifyOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N packed components', () => {
    expect(
      selectVerifyOffsetEntries(
        ['identity/personality.md', 'memory/core.json', 'conversations/index.json'],
        1,
      ),
    ).toEqual(['memory/core.json', 'conversations/index.json']);
  });

  it('returns all components when offset is omitted', () => {
    const components = ['identity/personality.md', 'memory/core.json'];
    expect(selectVerifyOffsetEntries(components, undefined)).toEqual(components);
  });

  it('skips components before --limit', () => {
    expect(
      applyVerifyFilters(
        ['identity/personality.md', 'memory/core.json', 'conversations/index.json'],
        { offset: '1', limit: '1' },
      ),
    ).toEqual(['memory/core.json']);
  });
});
