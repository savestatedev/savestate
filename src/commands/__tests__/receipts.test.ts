import { describe, expect, it } from 'vitest';
import { countReceiptResources, formatReceiptsJson, formatReceiptsText, parseReceiptType, parseReceiptsLimit, parseReceiptsOffset, resolveReceiptsLimit, resolveReceiptsOffset, selectReceipts } from '../receipts.js';

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

  it('preserves date filters in pagination guidance', () => {
    const receipts = [{ receipt_id: 'r-2' }] as never[];
    expect(formatReceiptsText(receipts, 2, 0, 1, '--limit', 'offset', undefined, false, false, undefined, '2026-01-01', '2026-01-31'))
      .toContain('--since 2026-01-01 --until 2026-01-31');
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

  it('supports oldest-first pagination', () => {
    const receipts = [
      { receipt_id: 'oldest' },
      { receipt_id: 'middle' },
      { receipt_id: 'newest' },
    ] as never[];
    expect(selectReceipts(receipts, 2, 0, undefined, false, false, undefined, true).map((receipt) => receipt.receipt_id))
      .toEqual(['oldest', 'middle']);
    expect(selectReceipts(receipts, 2, 1, undefined, false, false, undefined, true).map((receipt) => receipt.receipt_id))
      .toEqual(['middle', 'newest']);
  });

  it('counts resource types for machine-readable summaries', () => {
    const receipts = [
      { resource_type: 'snapshot' },
      { resource_type: 'memory' },
      { resource_type: 'memory' },
      { resource_type: 'checkpoint' },
    ] as never[];
    expect(countReceiptResources(receipts)).toEqual({ snapshot: 1, memory: 2, checkpoint: 1 });
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

  it('filters to unverified receipts before applying newest-first pagination', () => {
    const receipts = [
      { receipt_id: 'unverified-1', verified: false },
      { receipt_id: 'verified', verified: true },
      { receipt_id: 'unverified-2', verified: false },
    ] as never[];
    expect(selectReceipts(receipts, 1, 0, undefined, false, true).map((receipt) => receipt.receipt_id)).toEqual(['unverified-2']);
    expect(selectReceipts(receipts, 1, 1, undefined, false, true).map((receipt) => receipt.receipt_id)).toEqual(['unverified-1']);
  });

  it('filters receipts to one resource before applying newest-first pagination', () => {
    const receipts = [
      { receipt_id: 'memory-old', resource_id: 'memory-a' },
      { receipt_id: 'other', resource_id: 'memory-b' },
      { receipt_id: 'memory-new', resource_id: 'memory-a' },
    ] as never[];
    expect(selectReceipts(receipts, 1, 0, undefined, false, false, 'memory-a').map((receipt) => receipt.receipt_id))
      .toEqual(['memory-new']);
    expect(selectReceipts(receipts, 1, 1, undefined, false, false, 'memory-a').map((receipt) => receipt.receipt_id))
      .toEqual(['memory-old']);
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

  it('labels date filters in human output', () => {
    const receipts = [{ receipt_id: 'receipt-1' }] as never[];
    expect(formatReceiptsText(receipts, 1, 0, 10, '--limit', 'offset', undefined, false, false, undefined, '2026-01-01', '2026-01-31')).toContain(
      '[since: 2026-01-01] [until: 2026-01-31]',
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

  it('marks oldest-first JSON responses', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10, undefined, { verified: 0, unverified: 0 }, false, false, false, undefined, undefined, true, 0, undefined, undefined, true)))
      .toMatchObject({ oldestFirst: true });
  });

  it('identifies an unfiltered JSON response explicitly', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10))).toMatchObject({
      type: null, verification: { verified: 0, unverified: 0 }, resourceCounts: { snapshot: 0, memory: 0, checkpoint: 0 },
    });
  });

  it('reports resource totals for the complete matching collection', () => {
    const receipts = [{ resource_type: 'memory' }, { resource_type: 'snapshot' }] as never[];
    expect(JSON.parse(formatReceiptsJson([receipts[0]], 2, 0, 1, undefined, { verified: 0, unverified: 2 }, false, false, false, countReceiptResources(receipts))))
      .toMatchObject({ resourceCounts: { snapshot: 1, memory: 1, checkpoint: 0 } });
  });

  it('reports the saved-at range for the matching collection', () => {
    const receipts = [
      { resource_type: 'memory', saved_at: '2026-01-02T00:00:00.000Z' },
      { resource_type: 'snapshot', saved_at: '2026-01-05T00:00:00.000Z' },
    ] as never[];
    expect(JSON.parse(formatReceiptsJson(receipts, 2, 0, 10, undefined, { verified: 0, unverified: 2 }, false, false, false, countReceiptResources(receipts))))
      .toMatchObject({ latestSavedAt: '2026-01-05T00:00:00.000Z', oldestSavedAt: '2026-01-02T00:00:00.000Z' });
  });

  it('reports byte totals for the displayed receipts', () => {
    const receipts = [
      { size: 100, saved_at: '2026-01-02T00:00:00.000Z' },
      { size: 300, saved_at: '2026-01-05T00:00:00.000Z' },
    ] as never[];
    expect(JSON.parse(formatReceiptsJson(receipts, 2, 0, 10))).toMatchObject({
      shownBytes: 400, averageShownBytes: 200, totalBytes: 400, averageTotalBytes: 200,
    });
  });

  it('reports verification percentages for the collection and current page', () => {
    const receipts = [
      { verified: true, size: 100 },
      { verified: false, size: 200 },
      { verified: true, size: 300 },
    ] as never[];
    expect(JSON.parse(formatReceiptsJson([receipts[1]], 3, 1, 1, undefined, { verified: 2, unverified: 1 })))
      .toMatchObject({ verifiedPercentage: 66.66666666666666, shownVerifiedPercentage: 0 });
  });

  it('reports filtered collection bytes separately from a limited page', () => {
    const receipts = [
      { size: 100, saved_at: '2026-01-02T00:00:00.000Z' },
    ] as never[];
    const summary = JSON.parse(formatReceiptsJson(receipts, 2, 0, 1, undefined, { verified: 2, unverified: 0 }, false, false, false, undefined, countReceiptResources(receipts), true, 400));
    expect(summary).toMatchObject({ shown: 1, shownBytes: 100, total: 2, totalBytes: 400, averageTotalBytes: 200 });
  });

  it('can omit receipt records from JSON summaries', () => {
    const summary = JSON.parse(formatReceiptsJson([{ receipt_id: 'r-1', size: 12 }] as never[], 1, 0, 10, undefined, { verified: 1, unverified: 0 }, false, false, false, undefined, undefined, false));
    expect(summary).toMatchObject({ found: true, total: 1, shown: 1, shownBytes: 12 });
    expect(summary).not.toHaveProperty('receipts');
  });

  it('identifies a resource-filtered JSON response explicitly', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10, undefined, { verified: 0, unverified: 0 }, false, false, false, 'memory-a')))
      .toMatchObject({ resource: 'memory-a' });
  });

  it('reports verification totals for the matching collection', () => {
    expect(JSON.parse(formatReceiptsJson([], 2, 0, 10, undefined, { verified: 1, unverified: 1 })))
      .toMatchObject({ verification: { verified: 1, unverified: 1 } });
  });

  it('uses null saved-at bounds for an empty collection', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10))).toMatchObject({ latestSavedAt: null, oldestSavedAt: null, shownBytes: 0, averageShownBytes: null });
  });

  it('identifies verified-only JSON responses explicitly', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10, undefined, true))).toMatchObject({ verified: true });
  });

  it('identifies unverified-only JSON responses explicitly', () => {
    expect(JSON.parse(formatReceiptsJson([], 0, 0, 10, undefined, false, true))).toMatchObject({ verified: false, unverified: true });
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
