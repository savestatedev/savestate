import { describe, expect, it } from 'vitest';
import {
  applyMcpStatusFilters,
  formatMcpStatusPaginationHints,
  getMcpStatusPage,
  parseMcpStatusOffset,
  selectMcpStatusOffsetEntries,
} from '../mcp.js';

describe('savestate mcp status --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMcpStatusOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMcpStatusOffset('0')).toBe(0);
    expect(parseMcpStatusOffset('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseMcpStatusOffset(' 12 ')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpStatusOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMcpStatusOffset('1000')).toBe(1000);
    expect(() => parseMcpStatusOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N MCP tools or resources', () => {
    expect(
      selectMcpStatusOffsetEntries(
        ['savestate_snapshot', 'savestate_restore', 'savestate_list'],
        1,
      ),
    ).toEqual(['savestate_restore', 'savestate_list']);
  });

  it('returns all items when offset is omitted', () => {
    const items = ['savestate_snapshot', 'savestate_restore'];
    expect(selectMcpStatusOffsetEntries(items, undefined)).toEqual(items);
  });

  it('skips MCP tools or resources before --limit', () => {
    expect(
      applyMcpStatusFilters(
        ['savestate_snapshot', 'savestate_restore', 'savestate_list'],
        { offset: '1', limit: '1' },
      ),
    ).toEqual(['savestate_restore']);
  });

  it('reports the next offset for a partial page', () => {
    expect(getMcpStatusPage(7, 2, 2, 2)).toEqual({
      offset: 2,
      limit: 2,
      total: 7,
      shown: 2,
      hasMore: true,
      nextOffset: 4,
      hasPrevious: true,
      previousOffset: 0,
    });
  });

  it('reports the previous offset for later pages', () => {
    expect(getMcpStatusPage(7, 2, 4, 2)).toEqual({
      offset: 4,
      limit: 2,
      total: 7,
      shown: 2,
      hasMore: true,
      nextOffset: 6,
      hasPrevious: true,
      previousOffset: 2,
    });
  });

  it('formats terminal guidance for next and previous pages', () => {
    expect(
      formatMcpStatusPaginationHints({
        tools: getMcpStatusPage(7, 2, 2, 2),
        resources: getMcpStatusPage(2, 0, 2, 2),
      }),
    ).toEqual([
      'Tools previous page: use --offset 0 --limit 2.',
      'Tools next page: use --offset 4 --limit 2.',
      'Resources previous page: use --offset 0 --limit 2.',
    ]);
  });
});
