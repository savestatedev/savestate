import { describe, expect, it } from 'vitest';
import {
  applyMemoryListFilters,
  parseMemoryListOffset,
  selectMemoryListOffsetEntries,
} from '../memory.js';
import {
  parseMemoryListPage,
  resolveMemoryExplainLimit,
  resolveMemoryListLimit,
  resolveMemoryListOffset,
} from '../memory-cli.js';

describe('savestate memory list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryListOffset('0')).toBe(0);
    expect(parseMemoryListOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', '0x10', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryListOffset('1000')).toBe(1000);
    expect(() => parseMemoryListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N memories', () => {
    expect(
      selectMemoryListOffsetEntries(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['mem-2', 'mem-3']);
  });

  it('returns all memories when offset is omitted', () => {
    const entries = [{ id: 'mem-1' }, { id: 'mem-2' }];
    expect(selectMemoryListOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips memories before --limit', () => {
    expect(
      applyMemoryListFilters(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['mem-2']);
  });
});

describe('savestate memory list --page', () => {
  it('resolves one-based pages using the requested limit', () => {
    expect(parseMemoryListPage('2')).toBe(2);
    expect(resolveMemoryListOffset(undefined, '3', 20)).toBe(40);
  });

  it('rejects page zero and conflicting pagination flags', () => {
    expect(() => parseMemoryListPage('0')).toThrow('Expected a positive integer page number.');
    expect(() => resolveMemoryListOffset('20', '2', 20)).toThrow(
      'Cannot use --page with --offset; choose one pagination mode.',
    );
  });

  it('keeps page navigation inside the supported offset ceiling', () => {
    expect(resolveMemoryListOffset(undefined, '51', 20)).toBe(1000);
    expect(() => resolveMemoryListOffset(undefined, '52', 20)).toThrow(
      'maximum supported offset of 1000',
    );
  });
});

describe('savestate memory explain --page-size', () => {
  it('uses the alias while preserving explain\'s default page size', () => {
    expect(resolveMemoryExplainLimit('7', undefined)).toBe(7);
    expect(resolveMemoryExplainLimit(undefined, '12')).toBe(12);
    expect(resolveMemoryExplainLimit(undefined, undefined)).toBe(10);
  });

  it('rejects mixing page-size option names', () => {
    expect(() => resolveMemoryExplainLimit('7', '12')).toThrow(
      'Cannot use --limit with --page-size; choose one page-size option.',
    );
  });
});

describe('savestate memory explain --page', () => {
  it('resolves one-based result pages using explain\'s page size', () => {
    expect(resolveMemoryListOffset(undefined, '3', 10)).toBe(20);
    expect(resolveMemoryListOffset(undefined, '3', 25)).toBe(50);
  });

  it('rejects mixing explain page and offset modes', () => {
    expect(() => resolveMemoryListOffset('20', '2', 10)).toThrow(
      'Cannot use --page with --offset; choose one pagination mode.',
    );
  });
});

describe('savestate memory list --page-size', () => {
  it('uses the alias while preserving list\'s default page size', () => {
    expect(resolveMemoryListLimit('7', undefined)).toBe(7);
    expect(resolveMemoryListLimit(undefined, '12')).toBe(12);
    expect(resolveMemoryListLimit(undefined, undefined)).toBe(20);
  });

  it('rejects mixing page-size option names', () => {
    expect(() => resolveMemoryListLimit('7', '12')).toThrow(
      'Cannot use --limit with --page-size; choose one page-size option.',
    );
  });
});
