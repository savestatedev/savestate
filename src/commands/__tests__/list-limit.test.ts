import { describe, expect, it } from 'vitest';
import { parseListLimit, parseListPage, resolveListOffset } from '../list.js';

describe('savestate list --limit', () => {
  it('defaults to 50 snapshots', () => {
    expect(parseListLimit(undefined)).toBe(50);
  });

  it('accepts positive integers', () => {
    expect(parseListLimit('12')).toBe(12);
    expect(parseListLimit(' 12 ')).toBe(12);
  });

  it('accepts surrounding whitespace from scripted callers', () => {
    expect(parseListLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseListLimit('1000')).toBe(1000);
    expect(() => parseListLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });
});

describe('savestate list --page', () => {
  it('parses one-based page numbers and resolves them to offsets', () => {
    expect(parseListPage(' 3 ')).toBe(3);
    expect(resolveListOffset(undefined, '3', 20)).toBe(40);
  });

  it('rejects ambiguous or unsupported page input', () => {
    expect(() => parseListPage('0')).toThrow('Expected a positive integer.');
    expect(() => resolveListOffset('20', '2', 20)).toThrow('Cannot combine --page with --offset.');
    expect(() => resolveListOffset(undefined, '52', 20)).toThrow('offset ceiling');
  });
});
