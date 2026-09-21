import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyListFilters, parseListSnapshot } from '../list.js';

function entry(
  partial: Pick<SnapshotIndexEntry, 'id' | 'adapter'> & Partial<SnapshotIndexEntry>,
): SnapshotIndexEntry {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    platform: partial.adapter,
    filename: `${partial.id}.saf.enc`,
    size: 1,
    ...partial,
  };
}

describe('savestate list --snapshot', () => {
  it('leaves the id unset when omitted', () => {
    expect(parseListSnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseListSnapshot('ss-2026-09-13T12-00-00-ab12cd')).toBe(
      'ss-2026-09-13T12-00-00-ab12cd',
    );
    expect(parseListSnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseListSnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });

  it('keeps only the matching snapshot', () => {
    expect(
      applyListFilters(
        [
          entry({ id: 'keep', adapter: 'chatgpt' }),
          entry({ id: 'skip', adapter: 'chatgpt' }),
        ],
        { snapshot: 'keep' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['keep']);
  });

  it('ANDs --adapter with --snapshot', () => {
    expect(
      applyListFilters(
        [
          entry({ id: 'keep', adapter: 'chatgpt' }),
          entry({ id: 'keep', adapter: 'claude-code' }),
          entry({ id: 'skip', adapter: 'chatgpt' }),
        ],
        { adapter: 'chatgpt', snapshot: 'keep' },
      ).map((snapshot) => snapshot.adapter),
    ).toEqual(['chatgpt']);
  });
});
