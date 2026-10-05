import { describe, expect, it } from 'vitest';
import {
  applyTeamAuditFilters,
  parseTeamAuditOffset,
  selectTeamAuditOffsetEntries,
} from '../team.js';

describe('savestate team audit --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTeamAuditOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseTeamAuditOffset('0')).toBe(0);
    expect(parseTeamAuditOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamAuditOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseTeamAuditOffset('1000')).toBe(1000);
    expect(() => parseTeamAuditOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N entries', () => {
    expect(
      selectTeamAuditOffsetEntries(
        [{ id: 'invite' }, { id: 'join' }, { id: 'role' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['join', 'role']);
  });

  it('returns all entries when offset is omitted', () => {
    const entries = [{ id: 'invite' }, { id: 'join' }];
    expect(selectTeamAuditOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips entries before --limit', () => {
    expect(
      applyTeamAuditFilters(
        [{ id: 'invite' }, { id: 'join' }, { id: 'role' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['join']);
  });
});
