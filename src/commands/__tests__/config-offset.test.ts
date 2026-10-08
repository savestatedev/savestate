import { describe, expect, it } from 'vitest';
import {
  applyConfigFilters,
  parseConfigOffset,
  selectConfigOffsetEntries,
} from '../config.js';

describe('savestate config --offset', () => {
  it('defaults to undefined', () => {
    expect(parseConfigOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseConfigOffset('0')).toBe(0);
    expect(parseConfigOffset('12')).toBe(12);
  });

  it.each(['', '   ', '-1', '1.5', '0x10', '1e2', '+1', 'nope'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseConfigOffset(value)).toThrow(
        `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
      );
    },
  );

  it('rejects values above the bounded skip count', () => {
    expect(parseConfigOffset('1000')).toBe(1000);
    expect(() => parseConfigOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N configured adapters', () => {
    expect(
      selectConfigOffsetEntries(
        [{ id: 'clawdbot' }, { id: 'chatgpt' }, { id: 'gemini' }],
        1,
      ).map((adapter) => adapter.id),
    ).toEqual(['chatgpt', 'gemini']);
  });

  it('returns all adapters when offset is omitted', () => {
    const adapters = [{ id: 'clawdbot' }, { id: 'chatgpt' }];
    expect(selectConfigOffsetEntries(adapters, undefined)).toEqual(adapters);
  });

  it('skips adapters before --limit', () => {
    expect(
      applyConfigFilters(
        [{ id: 'clawdbot' }, { id: 'chatgpt' }, { id: 'gemini' }],
        { offset: '1', limit: '1' },
      ).map((adapter) => adapter.id),
    ).toEqual(['chatgpt']);
  });
});
