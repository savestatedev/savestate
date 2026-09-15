import { describe, expect, it } from 'vitest';
import { parseSnapshotMeta } from '../snapshot.js';

describe('savestate snapshot --meta', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotMeta(undefined)).toBeUndefined();
  });

  it('accepts key=value entries', () => {
    expect(parseSnapshotMeta('confidence=high')).toEqual({
      key: 'confidence',
      value: 'high',
    });
    expect(parseSnapshotMeta('formula=x=y+z')).toEqual({
      key: 'formula',
      value: 'x=y+z',
    });
    expect(parseSnapshotMeta(' source=cli ')).toEqual({
      key: 'source',
      value: 'cli',
    });
  });

  it.each(['', ' ', 'nocolon', '=value', 'key=', ' =high ', 'confidence= '])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSnapshotMeta(value)).toThrow(
        `Invalid --meta value "${value}". Expected key=value with a non-empty key and value.`,
      );
    },
  );
});
