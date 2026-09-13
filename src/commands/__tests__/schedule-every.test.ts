import { describe, expect, it } from 'vitest';
import { parseScheduleEvery } from '../schedule.js';

describe('savestate schedule --every', () => {
  it('accepts minute, hour, and day durations', () => {
    expect(parseScheduleEvery('1m')).toBe(60);
    expect(parseScheduleEvery('1h')).toBe(3600);
    expect(parseScheduleEvery('6h')).toBe(21600);
    expect(parseScheduleEvery('12h')).toBe(43200);
    expect(parseScheduleEvery('1d')).toBe(86400);
    expect(parseScheduleEvery('7d')).toBe(604800);
    expect(parseScheduleEvery(' 6H ')).toBe(21600);
  });

  it.each(['', ' ', 'nope', '0h', '0d', '1w', '8d', '169h'])('rejects invalid value %s', (value) => {
    expect(() => parseScheduleEvery(value)).toThrow(
      `Invalid --every value "${value}". Expected a duration like 1h, 6h, 12h, or 1d up to 7 days.`,
    );
  });
});
