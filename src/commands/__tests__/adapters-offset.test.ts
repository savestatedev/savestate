import { describe, expect, it } from 'vitest';
import {
  applyAdaptersFilters,
  parseAdaptersOffset,
  selectAdaptersOffset,
  type AdapterListEntry,
} from '../adapters.js';

function adapter(partial: Partial<AdapterListEntry>): AdapterListEntry {
  return {
    id: partial.id ?? 'clawdbot',
    name: partial.name ?? 'Clawdbot',
    platform: partial.platform ?? 'clawdbot',
    version: partial.version ?? '1',
    detected: partial.detected ?? false,
  };
}

describe('savestate adapters --offset', () => {
  it('defaults to undefined', () => {
    expect(parseAdaptersOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseAdaptersOffset('0')).toBe(0);
    expect(parseAdaptersOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAdaptersOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseAdaptersOffset('1000')).toBe(1000);
    expect(() => parseAdaptersOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N adapters', () => {
    expect(
      selectAdaptersOffset(
        [adapter({ id: 'a1' }), adapter({ id: 'a2' }), adapter({ id: 'a3' })],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['a2', 'a3']);
  });

  it('returns all adapters when offset is omitted', () => {
    const adapters = [adapter({ id: 'a1' }), adapter({ id: 'a2' })];
    expect(selectAdaptersOffset(adapters, undefined)).toEqual(adapters);
  });

  it('skips adapters before --limit', () => {
    expect(
      applyAdaptersFilters(
        [
          adapter({ id: 'clawdbot' }),
          adapter({ id: 'chatgpt' }),
          adapter({ id: 'gemini' }),
        ],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['chatgpt']);
  });
});
