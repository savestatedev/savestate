import { describe, expect, it } from 'vitest';
import { parseAntibodiesAddLimit, selectAntibodiesAddEntries } from '../antibodies.js';

describe('savestate antibodies add --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesAddLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAntibodiesAddLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesAddLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAntibodiesAddLimit('1000')).toBe(1000);
    expect(() => parseAntibodiesAddLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectAntibodiesAddEntries(
        [{ id: 'id' }, { id: 'safe_action' }, { id: 'confidence' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['id', 'safe_action']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'id' }, { id: 'safe_action' }];
    expect(selectAntibodiesAddEntries(entries, undefined)).toEqual(entries);
  });
});
