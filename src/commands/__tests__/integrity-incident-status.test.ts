import { describe, expect, it } from 'vitest';
import { parseIntegrityIncidentStatus } from '../integrity.js';

describe('savestate integrity incidents --status', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityIncidentStatus(undefined)).toBeUndefined();
  });

  it('accepts known incident statuses', () => {
    expect(parseIntegrityIncidentStatus('open')).toBe('open');
    expect(parseIntegrityIncidentStatus('investigating')).toBe('investigating');
    expect(parseIntegrityIncidentStatus('CONTAINED')).toBe('contained');
    expect(parseIntegrityIncidentStatus('resolved')).toBe('resolved');
    expect(parseIntegrityIncidentStatus('false_positive')).toBe('false_positive');
  });

  it.each(['', ' ', 'nope', 'closed', '1'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityIncidentStatus(value)).toThrow(
      `Invalid --status value "${value}". Expected one of: open, investigating, contained, resolved, false_positive.`,
    );
  });
});
