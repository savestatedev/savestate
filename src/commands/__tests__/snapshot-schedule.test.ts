import { describe, expect, it } from 'vitest';
import { parseSnapshotSchedule } from '../snapshot.js';

describe('savestate snapshot --schedule', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotSchedule(undefined)).toBeUndefined();
  });

  it('accepts minute, hour, and day durations', () => {
    expect(parseSnapshotSchedule('1m')).toBe('1m');
    expect(parseSnapshotSchedule('1h')).toBe('1h');
    expect(parseSnapshotSchedule('6h')).toBe('6h');
    expect(parseSnapshotSchedule('12h')).toBe('12h');
    expect(parseSnapshotSchedule('1d')).toBe('1d');
    expect(parseSnapshotSchedule('7d')).toBe('7d');
    expect(parseSnapshotSchedule(' 6H ')).toBe('6H');
  });

  it.each(['', ' ', 'nope', '0h', '0d', '1w', '8d', '169h'])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotSchedule(value)).toThrow(
      `Invalid --schedule value "${value}". Expected a duration like 1h, 6h, 12h, or 1d up to 7 days.`,
    );
  });
});
