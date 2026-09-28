import { describe, expect, it } from 'vitest';
import { parseMcpStatusLimit, selectMcpStatusItems } from '../mcp.js';

describe('savestate mcp status --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMcpStatusLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMcpStatusLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpStatusLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMcpStatusLimit('1000')).toBe(1000);
    expect(() => parseMcpStatusLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N MCP tools or resources', () => {
    expect(
      selectMcpStatusItems(
        ['savestate_snapshot', 'savestate_restore', 'savestate_list'],
        2,
      ),
    ).toEqual(['savestate_snapshot', 'savestate_restore']);
  });

  it('returns all items when --limit is omitted', () => {
    const items = ['savestate_snapshot', 'savestate_restore'];
    expect(selectMcpStatusItems(items, undefined)).toEqual(items);
  });
});
