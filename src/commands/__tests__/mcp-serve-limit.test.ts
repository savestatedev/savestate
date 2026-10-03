import { describe, expect, it } from 'vitest';
import { parseMcpServeLimit, selectMcpServeEntries } from '../mcp.js';

describe('savestate mcp serve --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMcpServeLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMcpServeLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpServeLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMcpServeLimit('1000')).toBe(1000);
    expect(() => parseMcpServeLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMcpServeEntries(
        [{ id: 'transport' }, { id: 'client' }, { id: 'extra' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['transport', 'client']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'transport' }, { id: 'client' }];
    expect(selectMcpServeEntries(entries, undefined)).toEqual(entries);
  });
});
