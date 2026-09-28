import { describe, expect, it } from 'vitest';
import { parseMcpExportLimit, selectMcpExportItems } from '../mcp.js';

describe('savestate mcp export --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMcpExportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMcpExportLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpExportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMcpExportLimit('1000')).toBe(1000);
    expect(() => parseMcpExportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N memories or snapshot rows', () => {
    expect(
      selectMcpExportItems(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        2,
      ).map((item) => item.id),
    ).toEqual(['a', 'b']);
  });

  it('returns all items when --limit is omitted', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(selectMcpExportItems(items, undefined)).toEqual(items);
  });
});
