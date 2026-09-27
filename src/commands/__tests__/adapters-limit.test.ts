import { describe, expect, it } from 'vitest';
import { parseAdaptersLimit, selectAdapters } from '../adapters.js';

describe('savestate adapters --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAdaptersLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAdaptersLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAdaptersLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAdaptersLimit('1000')).toBe(1000);
    expect(() => parseAdaptersLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N adapters', () => {
    expect(
      selectAdapters(
        [
          { id: 'clawdbot', name: 'Clawdbot', platform: 'clawdbot', version: '1', detected: true },
          { id: 'chatgpt', name: 'ChatGPT', platform: 'chatgpt', version: '1', detected: false },
          { id: 'gemini', name: 'Gemini', platform: 'gemini', version: '1', detected: false },
        ],
        2,
      ).map((adapter) => adapter.id),
    ).toEqual(['clawdbot', 'chatgpt']);
  });

  it('returns all adapters when --limit is omitted', () => {
    const adapters = [
      { id: 'clawdbot', name: 'Clawdbot', platform: 'clawdbot', version: '1', detected: true },
      { id: 'chatgpt', name: 'ChatGPT', platform: 'chatgpt', version: '1', detected: false },
    ];
    expect(selectAdapters(adapters, undefined)).toEqual(adapters);
  });
});
