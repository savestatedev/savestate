import { describe, expect, it } from 'vitest';
import { parseIntegrityIncidentId } from '../integrity.js';

describe('savestate integrity incident id', () => {
  it('accepts a single incident id', () => {
    expect(parseIntegrityIncidentId('inc-123')).toBe('inc-123');
    expect(parseIntegrityIncidentId('inc-2026-09-20')).toBe('inc-2026-09-20');
    expect(parseIntegrityIncidentId(' inc-123 ')).toBe('inc-123');
  });

  it.each(['', ' ', ',', 'inc-1,inc-2', 'inc 123'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegrityIncidentId(value)).toThrow(
        `Invalid incident id "${value}". Expected a single non-empty incident id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseIntegrityIncidentId(undefined)).toThrow(
      'Invalid incident id. Expected a single non-empty incident id.',
    );
  });
});
