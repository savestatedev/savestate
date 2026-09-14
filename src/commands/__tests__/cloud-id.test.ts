import { describe, expect, it } from 'vitest';
import { parseCloudId } from '../cloud.js';

describe('savestate cloud --id', () => {
  it('defaults to undefined', () => {
    expect(parseCloudId(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseCloudId('ss-2026-01-26')).toBe('ss-2026-01-26');
    expect(parseCloudId('ss-2026-09-14T12-00-00-ab12cd')).toBe(
      'ss-2026-09-14T12-00-00-ab12cd',
    );
    expect(parseCloudId(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudId(value)).toThrow(
      `Invalid --id value "${value}". Expected a single non-empty snapshot id.`,
    );
  });
});
