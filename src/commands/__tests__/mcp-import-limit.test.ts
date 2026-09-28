import { describe, expect, it } from 'vitest';
import { parseMcpImportLimit, selectMcpImportItems } from '../mcp.js';

describe('savestate mcp import --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMcpImportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMcpImportLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpImportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMcpImportLimit('1000')).toBe(1000);
    expect(() => parseMcpImportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N passport memories', () => {
    expect(
      selectMcpImportItems(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        2,
      ).map((item) => item.id),
    ).toEqual(['a', 'b']);
  });

  it('returns all items when --limit is omitted', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(selectMcpImportItems(items, undefined)).toEqual(items);
  });
});
