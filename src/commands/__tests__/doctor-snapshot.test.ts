import { describe, expect, it } from 'vitest';
import { parseDoctorSnapshot, resolveDoctorSnapshots } from '../doctor.js';

describe('savestate doctor --snapshot', () => {
  it('leaves the id unset when omitted', () => {
    expect(parseDoctorSnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseDoctorSnapshot('ss-2026-09-13T12-00-00-ab12cd')).toBe(
      'ss-2026-09-13T12-00-00-ab12cd',
    );
    expect(parseDoctorSnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseDoctorSnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });

  it('keeps only the matching snapshot', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'keep', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'skip', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'keep' },
      ).map((entry) => entry.id),
    ).toEqual(['keep']);
  });

  it('ANDs --adapter with --snapshot', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'keep', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'keep', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'skip', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { adapter: 'chatgpt', snapshot: 'keep' },
      ).map((entry) => entry.adapter),
    ).toEqual(['chatgpt']);
  });
});
