import { describe, expect, it } from 'vitest';
import { parseTeamAuditFormat } from '../team.js';

describe('savestate team audit --format', () => {
  it('defaults to json', () => {
    expect(parseTeamAuditFormat(undefined)).toBe('json');
  });

  it('accepts known audit formats', () => {
    expect(parseTeamAuditFormat('csv')).toBe('csv');
    expect(parseTeamAuditFormat('json')).toBe('json');
    expect(parseTeamAuditFormat('CSV')).toBe('csv');
    expect(parseTeamAuditFormat(' Json ')).toBe('json');
  });

  it.each(['', ' ', 'xml', 'yaml', '1'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamAuditFormat(value)).toThrow(
      `Invalid --format value "${value}". Expected one of: csv, json.`,
    );
  });
});
