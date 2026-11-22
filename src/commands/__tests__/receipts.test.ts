import { describe, expect, it } from 'vitest';
import { formatReceiptsJson, parseReceiptsLimit, parseReceiptsOffset } from '../receipts.js';

describe('receipts command', () => {
  it('defaults to the latest 100 receipts', () => {
    expect(parseReceiptsLimit(undefined)).toBe(100);
  });

  it('accepts bounded positive limits', () => {
    expect(parseReceiptsLimit('25')).toBe(25);
    expect(parseReceiptsLimit('1000')).toBe(1000);
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

  it('reports continuation metadata for JSON consumers', () => {
    const receipts = [{ receipt_id: 'r-1' }] as never[];
    expect(JSON.parse(formatReceiptsJson(receipts, 3, 0, 1))).toMatchObject({
      found: true,
      total: 3,
      shown: 1,
      offset: 0,
      limit: 1,
      remaining: 2,
      hasMore: true,
      nextOffset: 1,
    });
  });
});
