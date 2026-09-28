import { describe, expect, it } from 'vitest';
import { parseConfigLimit, selectConfigAdapters } from '../config.js';

describe('savestate config --limit', () => {
  it('defaults to undefined', () => {
    expect(parseConfigLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseConfigLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseConfigLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseConfigLimit('1000')).toBe(1000);
    expect(() => parseConfigLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N configured adapters', () => {
    expect(
      selectConfigAdapters(
        [{ id: 'clawdbot' }, { id: 'chatgpt' }, { id: 'gemini' }],
        2,
      ).map((adapter) => adapter.id),
    ).toEqual(['clawdbot', 'chatgpt']);
  });

  it('returns all adapters when --limit is omitted', () => {
    const adapters = [{ id: 'clawdbot' }, { id: 'chatgpt' }];
    expect(selectConfigAdapters(adapters, undefined)).toEqual(adapters);
  });
});
