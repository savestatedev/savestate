import { describe, expect, it } from 'vitest';
import { applyTeamAuditLimit, parseTeamAuditLimit } from '../team.js';

describe('savestate team audit --limit', () => {
  it('leaves the audit log uncapped when omitted', () => {
    expect(parseTeamAuditLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTeamAuditLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamAuditLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTeamAuditLimit('1000')).toBe(1000);
    expect(() => parseTeamAuditLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N entries', () => {
    expect(
      applyTeamAuditLimit(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        parseTeamAuditLimit('2'),
      ).map((entry) => entry.id),
    ).toEqual(['a', 'b']);
  });

  it('ANDs --since/--until results with --limit', () => {
    expect(
      applyTeamAuditLimit(
        [{ id: 'mid' }, { id: 'new' }],
        parseTeamAuditLimit('1'),
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });
});
