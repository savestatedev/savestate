import { describe, expect, it } from 'vitest';
import { parseIntegrityTargetId } from '../integrity.js';

describe('savestate integrity quarantine id', () => {
  it('accepts a single memory or agent id', () => {
    expect(parseIntegrityTargetId('mem-123')).toBe('mem-123');
    expect(parseIntegrityTargetId('agent_session-2026-09-20')).toBe('agent_session-2026-09-20');
    expect(parseIntegrityTargetId(' mem-123 ')).toBe('mem-123');
  });

  it.each(['', ' ', ',', 'mem-1,mem-2', 'mem 123'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegrityTargetId(value)).toThrow(
        `Invalid memory or agent id "${value}". Expected a single non-empty memory or agent id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseIntegrityTargetId(undefined)).toThrow(
      'Invalid memory or agent id. Expected a single non-empty memory or agent id.',
    );
  });
});
