import { describe, expect, it } from 'vitest';
import { parseSnapshotTags } from '../snapshot.js';

describe('savestate snapshot --tags', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotTags(undefined)).toBeUndefined();
  });

  it('accepts one or more snapshot tags', () => {
    expect(parseSnapshotTags('backup')).toEqual(['backup']);
    expect(parseSnapshotTags('important,v2')).toEqual(['important', 'v2']);
    expect(parseSnapshotTags(' weekly , backup ')).toEqual(['weekly', 'backup']);
  });

  it.each(['', ' ', ',', 'backup,', ',v2', 'a,,b'])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotTags(value)).toThrow(
      `Invalid --tags value "${value}". Expected one or more non-empty snapshot tags (comma-separated).`,
    );
  });
});
