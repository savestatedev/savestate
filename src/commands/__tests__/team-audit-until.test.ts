import { describe, expect, it } from 'vitest';
import { parseTeamAuditUntil } from '../team.js';

describe('savestate team audit --until', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseTeamAuditUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseTeamAuditUntil('2026-01-01')).toBe('2026-01-01');
    expect(parseTeamAuditUntil('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00Z');
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTeamAuditUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );
});
