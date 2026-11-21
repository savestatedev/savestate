import { describe, expect, it } from 'vitest';
import { parseReceiptsLimit } from '../receipts.js';

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
});
