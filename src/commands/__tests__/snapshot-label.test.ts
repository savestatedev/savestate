import { describe, expect, it } from 'vitest';
import { parseSnapshotLabel } from '../snapshot.js';

describe('savestate snapshot --label', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseSnapshotLabel('auto')).toBe('auto');
    expect(parseSnapshotLabel('Before migration')).toBe('Before migration');
    expect(parseSnapshotLabel(' Pre-update backup ')).toBe('Pre-update backup');
  });

  it.each(['', ' ', ',', 'pre,post'])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });
});
