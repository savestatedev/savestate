import { describe, expect, it } from 'vitest';
import { parseMigrateSnapshot } from '../migrate.js';

describe('savestate migrate --snapshot', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateSnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseMigrateSnapshot('ss-2026-09-14T12-00-00-ab12cd')).toBe(
      'ss-2026-09-14T12-00-00-ab12cd',
    );
    expect(parseMigrateSnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateSnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });
});
