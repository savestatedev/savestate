import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import { filterMemoryListByCreatedUntil } from '../memory.js';
import { parseMemoryListSince, parseMemoryListUntil, validateMemoryListDateRange } from '../memory-cli.js';

function entry(id: string, createdAt: string): MemoryEntry {
  return { id, content: id, source: 'test', createdAt };
}

describe('savestate memory list --until', () => {
  it('accepts ISO dates and trims surrounding whitespace', () => {
    expect(parseMemoryListUntil(' 2026-10-01 ')).toBe('2026-10-01');
    expect(parseMemoryListUntil(undefined)).toBeUndefined();
  });

  it('rejects blank and invalid dates', () => {
    expect(() => parseMemoryListUntil('   ')).toThrow(
      'Invalid --until value "   ". Expected an ISO-8601 date or timestamp.',
    );
    expect(() => parseMemoryListUntil('not-a-date')).toThrow(
      'Invalid --until value "not-a-date". Expected an ISO-8601 date or timestamp.',
    );
    expect(() => parseMemoryListUntil('10/01/2026')).toThrow(
      'Invalid --until value "10/01/2026". Expected an ISO-8601 date or timestamp.',
    );
    expect(() => parseMemoryListSince('10/01/2026')).toThrow(
      'Invalid --since value "10/01/2026". Expected an ISO-8601 date or timestamp.',
    );
    expect(() => parseMemoryListUntil('2026-02-30')).toThrow(
      'Invalid --until value "2026-02-30". Expected an ISO-8601 date or timestamp.',
    );
    expect(() => parseMemoryListSince('2026-02-30T12:00:00Z')).toThrow(
      'Invalid --since value "2026-02-30T12:00:00Z". Expected an ISO-8601 date or timestamp.',
    );
  });

  it('accepts ISO timestamps with timezone and fractional seconds', () => {
    expect(parseMemoryListSince('2026-10-01T12:34:56.789Z')).toBe('2026-10-01T12:34:56.789Z');
    expect(parseMemoryListUntil('2026-10-01T12:34+05:30')).toBe('2026-10-01T12:34+05:30');
  });

  it('includes the full day for a date-only cutoff', () => {
    const entries = [
      entry('before', '2026-09-30T23:59:59.999Z'),
      entry('same-day', '2026-10-01T18:00:00.000Z'),
      entry('after', '2026-10-02T00:00:00.000Z'),
    ];

    expect(filterMemoryListByCreatedUntil(entries, '2026-10-01').map(({ id }) => id)).toEqual([
      'before',
      'same-day',
    ]);
  });

  it('rejects an inverted since/until range before loading memories', () => {
    const since = parseMemoryListSince('2026-10-10');
    const until = parseMemoryListUntil('2026-10-09');

    expect(() => validateMemoryListDateRange(since, until)).toThrow(
      'Invalid memory date range: --since (2026-10-10) must be on or before --until (2026-10-09).',
    );
    expect(() => validateMemoryListDateRange('2026-10-09', '2026-10-10')).not.toThrow();
  });

  it('allows a timestamp within an inclusive date-only until day', () => {
    expect(() => validateMemoryListDateRange(
      '2026-10-01T12:00:00Z',
      '2026-10-01',
    )).not.toThrow();
  });
});
