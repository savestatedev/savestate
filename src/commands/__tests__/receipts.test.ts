import { describe, expect, it } from 'vitest';
import { formatReceiptsJson, formatReceiptsText, parseReceiptsLimit, parseReceiptsOffset, resolveReceiptsLimit, resolveReceiptsOffset } from '../receipts.js';

describe('receipts command', () => {
  it('defaults to the latest 100 receipts', () => {
    expect(parseReceiptsLimit(undefined)).toBe(100);
  });

  it('accepts bounded positive limits', () => {
    expect(parseReceiptsLimit('25')).toBe(25);
    expect(parseReceiptsLimit('1000')).toBe(1000);
  });

  it('accepts the readable page-size alias and rejects ambiguous paging', () => {
    expect(resolveReceiptsLimit(undefined, '25')).toBe(25);
    expect(() => resolveReceiptsLimit('10', '25')).toThrow(/either --limit or --page-size/);
  });

  it('rejects invalid limits', () => {
    expect(() => parseReceiptsLimit('0')).toThrow(/positive integer/);
    expect(() => parseReceiptsLimit('1001')).toThrow(/up to 1000/);
    expect(() => parseReceiptsLimit('1.5')).toThrow(/positive integer/);
  });

  it('defaults and accepts offsets', () => {
    expect(parseReceiptsOffset(undefined)).toBe(0);
    expect(parseReceiptsOffset('25')).toBe(25);
  });

  it('rejects invalid offsets', () => {
    expect(() => parseReceiptsOffset('-1')).toThrow(/non-negative integer/);
    expect(() => parseReceiptsOffset('1.5')).toThrow(/non-negative integer/);
  });

  it('resolves 1-based pages and rejects ambiguous or invalid paging', () => {
    expect(resolveReceiptsOffset(undefined, '3', 25)).toBe(50);
    expect(() => resolveReceiptsOffset('25', '2', 25)).toThrow(/either --offset or --page/);
    expect(() => resolveReceiptsOffset(undefined, '0', 25)).toThrow(/positive integer/);
  });

  it('shows human-readable page navigation', () => {
    const receipts = [{ receipt_id: 'r-2' }] as never[];
    expect(formatReceiptsText(receipts, 3, 1, 1)).toContain('Save receipts (1 of 3, page 2/3)');
    expect(formatReceiptsText(receipts, 3, 1, 1)).toContain(
      'Next page: savestate receipts --limit 1 --offset 2',
    );
    expect(formatReceiptsText(receipts, 3, 1, 1)).toContain(
      'Previous page: savestate receipts --limit 1 --offset 0',
    );
  });

  it('preserves the page-size alias in human navigation', () => {
    const receipts = [{ receipt_id: 'r-2' }] as never[];
    expect(formatReceiptsText(receipts, 3, 1, 1, '--page-size')).toContain(
      'Next page: savestate receipts --page-size 1 --offset 2',
    );
  });

  it('guides empty human pages to the last available page', () => {
    expect(formatReceiptsText([], 3, 9, 2)).toBe(
      'No save receipts found at offset 9. Try "savestate receipts --limit 2 --offset 2".',
    );
  });

  it('reports continuation metadata for JSON consumers', () => {
    const receipts = [{ receipt_id: 'r-2' }] as never[];
    expect(JSON.parse(formatReceiptsJson(receipts, 3, 1, 1))).toMatchObject({
      found: true, total: 3, shown: 1, emptyReason: null, offset: 1, limit: 1,
      remaining: 1, hasMore: true, isLastPage: false, nextOffset: 2, page: 2, totalPages: 3,
      hasPrevious: true, previousOffset: 0, suggestedOffset: null, guidance: { action: 'next', offset: 2 },
    });
  });

  it('guides stale offsets in JSON back to the last available page', () => {
    expect(JSON.parse(formatReceiptsJson([], 3, 9, 2))).toMatchObject({
      found: false, emptyReason: 'page', suggestedOffset: 2, hasMore: false, isLastPage: true,
      previousOffset: 2, guidance: { action: 'retry', offset: 2 },
    });
  });

  it('keeps human navigation on page numbers when --page is used', () => {
    const receipts = [{ receipt_id: 'r-2' }] as never[];
    expect(formatReceiptsText(receipts, 3, 1, 1, '--page-size', 'page')).toContain(
      'Next page: savestate receipts --page-size 1 --page 3',
    );
    expect(formatReceiptsText([], 3, 9, 2, '--limit', 'page')).toBe(
      'No save receipts found at page 5. Try "savestate receipts --limit 2 --page 2".',
    );
  });
});
