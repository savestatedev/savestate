import { describe, expect, it } from 'vitest';
import { parseSloPeriod } from '../slo.js';

describe('savestate slo report --period', () => {
  it('defaults to 7 days', () => {
    expect(parseSloPeriod(undefined)).toBe(7);
  });

  it('accepts hour, day, and week durations', () => {
    expect(parseSloPeriod('24h')).toBe(1);
    expect(parseSloPeriod('7d')).toBe(7);
    expect(parseSloPeriod('30d')).toBe(30);
    expect(parseSloPeriod('1w')).toBe(7);
  });

  it.each(['0d', '-1d', 'nope', '', '366d', '53w'])('rejects invalid value %s', (value) => {
    expect(() => parseSloPeriod(value)).toThrow(
      `Invalid --period value "${value}". Expected a duration like 24h, 7d, or 1w up to 365 days.`,
    );
  });
});
