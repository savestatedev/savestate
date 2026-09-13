import { describe, expect, it } from 'vitest';
import { parseTeamAuditSince } from '../team.js';

describe('savestate team audit --since', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseTeamAuditSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseTeamAuditSince('2026-01-01')).toBe('2026-01-01');
    expect(parseTeamAuditSince('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00Z');
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTeamAuditSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );
});
