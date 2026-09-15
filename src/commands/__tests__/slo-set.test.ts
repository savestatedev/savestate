import { describe, expect, it } from 'vitest';
import { parseSloSet } from '../slo.js';

describe('savestate slo --set', () => {
  it('defaults to undefined', () => {
    expect(parseSloSet(undefined)).toBeUndefined();
  });

  it('accepts a non-empty key=value pair', () => {
    expect(parseSloSet('enabled=true')).toEqual({ path: 'enabled', value: 'true' });
    expect(parseSloSet('freshness.max_age_hours=720')).toEqual({
      path: 'freshness.max_age_hours',
      value: '720',
    });
    expect(parseSloSet(' enabled = true ')).toEqual({ path: 'enabled', value: 'true' });
  });

  it.each(['', ' ', '=', 'enabled=', '=true', 'enabled', 'enabled = '])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSloSet(value)).toThrow(
        `Invalid --set value "${value}". Expected a non-empty key=value pair.`,
      );
    },
  );
});
