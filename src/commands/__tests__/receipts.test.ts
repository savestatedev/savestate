import { describe, expect, it } from 'vitest';
import { formatReceiptsJson, formatReceiptsText, parseReceiptType, parseReceiptsLimit, parseReceiptsOffset, resolveReceiptsLimit, resolveReceiptsOffset, selectReceipts } from '../receipts.js';

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

  it('accepts supported resource types and rejects unknown filters', () => {
    expect(parseReceiptType('memory')).toBe('memory');
    expect(parseReceiptType(' MEMORY ')).toBe('memory');
    expect(parseReceiptType(undefined)).toBeUndefined();
    expect(() => parseReceiptType('other')).toThrow(/snapshot, memory, or checkpoint/);
  });

  it('filters receipts before applying newest-first pagination', () => {
    const receipts = [
      { receipt_id: 'snapshot-1', resource_type: 'snapshot' },
      { receipt_id: 'memory-1', resource_type: 'memory' },
      { receipt_id: 'memory-2', resource_type: 'memory' },
    ] as never[];
    expect(selectReceipts(receipts, 1, 0, 'memory').map((receipt) => receipt.receipt_id)).toEqual(['memory-2']);
    expect(selectReceipts(receipts, 1, 1, 'memory').map((receipt) => receipt.receipt_id)).toEqual(['memory-1']);
  });

  it('filters to verified receipts before applying newest-first pagination', () => {
    const receipts = [
      { receipt_id: 'unverified', verified: false },
      { receipt_id: 'verified-1', verified: true },
      { receipt_id: 'verified-2', verified: true },
    ] as never[];
    expect(selectReceipts(receipts, 1, 0, undefined, true).map((receipt) => receipt.receipt_id)).toEqual(['verified-2']);
    expect(selectReceipts(receipts, 1, 1, undefined, true).map((receipt) => receipt.receipt_id)).toEqual(['verified-1']);
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

  it('reports filtered totals in human output', () => {
    const receipts = [{ receipt_id: 'memory-1' }] as never[];
    expect(formatReceiptsText(receipts, 1, 0, 10, '--limit', 'offset', 'memory')).toContain(
      'Save receipts (1 of 1, page 1/1) [type: memory]',
    );
  });

  it('labels verified-only human output and preserves the filter in navigation', () => {
    const receipts = [{ receipt_id: 'verified-1' }] as never[];
    expect(formatReceiptsText(receipts, 2, 0, 1, '--limit', 'offset', undefined, true)).toContain('[verified]');
    expect(formatReceiptsText(receipts, 2, 0, 1, '--limit', 'offset', undefined, true)).toContain('--verified');
  });

  it('explains when a resource type has no receipts', () => {
    expect(formatReceiptsText([], 0, 0, 10, '--limit', 'offset', 'checkpoint')).toBe(
      'No checkpoint save receipts found.',
    );
  });

  it('guides empty human pages to the last available page', () => {
    expect(formatReceiptsText([], 3, 9, 2)).toBe(
      'No save receipts found at offset 9. Try "savestate receipts --limit 2 --offset 2".',
    );
  });

  it('reports continuation metadata for JSON consumers', () => {
    const receipts = [{ receipt_id: 'r-2' }] as never[];
    expect(JSON.parse(formatReceiptsJson(receipts, 3, 1, 1, 'memory'))).toMatchObject({
      found: true, type: 'memory', total: 3, shown: 1, emptyReason: null, offset: 1, limit: 1,
      remaining: 1, hasMore: true, isLastPage: false, nextOffset: 2, nextPage: 3, page: 2, totalPages: 3,
      hasPrevious: true, previousOffset: 0, previousPage: 1, suggestedOffset: null, guidance: { action: 'next', offset: 2 },
    });
  });

  it('identifies an unfiltered JSON response explicitly', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10))).toMatchObject({ type: null });
  });

  it('identifies verified-only JSON responses explicitly', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10, undefined, true))).toMatchObject({ verified: true });
  });

  it('guides stale offsets in JSON back to the last available page', () => {
    expect(JSON.parse(formatReceiptsJson([], 3, 9, 2))).toMatchObject({
      found: false, emptyReason: 'page', suggestedOffset: 2, hasMore: false, isLastPage: true,
      previousOffset: 2, previousPage: 2, guidance: { action: 'retry', offset: 2 },
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

  it('preserves the type filter in pagination guidance', () => {
    const receipts = [{ receipt_id: 'memory-1' }] as never[];
    expect(formatReceiptsText(receipts, 2, 0, 1, '--limit', 'page', 'memory')).toContain(
      'Next page: savestate receipts --limit 1 --page 2 --type memory',
    );
  });
});
