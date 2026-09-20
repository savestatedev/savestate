import { describe, expect, it } from 'vitest';
import { parseDoctorTag, resolveDoctorSnapshots } from '../doctor.js';

describe('savestate doctor --tag', () => {
  it('defaults to undefined', () => {
    expect(parseDoctorTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseDoctorTag('work')).toBe('work');
    expect(parseDoctorTag('weekly')).toBe('weekly');
    expect(parseDoctorTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseDoctorTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('keeps snapshots that include the tag', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'work', adapter: 'chatgpt', tags: ['work'] },
          { id: 'personal', adapter: 'chatgpt', tags: ['personal'] },
        ],
        { tag: 'work' },
      ),
    ).toEqual(['work']);
  });

  it('ANDs --adapter with --tag', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'work-gpt', adapter: 'chatgpt', tags: ['work'] },
          { id: 'work-claude', adapter: 'claude-code', tags: ['work'] },
        ],
        { adapter: 'chatgpt', tag: 'work' },
      ),
    ).toEqual(['work-gpt']);
  });
});
