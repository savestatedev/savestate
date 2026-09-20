import { describe, expect, it } from 'vitest';
import { parseContextRunId } from '../context.js';

describe('savestate context explain run-id', () => {
  it('accepts a single run id', () => {
    expect(parseContextRunId('run_abc123')).toBe('run_abc123');
    expect(parseContextRunId('run-2026-09-20')).toBe('run-2026-09-20');
    expect(parseContextRunId(' run_abc123 ')).toBe('run_abc123');
  });

  it.each(['', ' ', ',', 'run_1,run_2', 'run abc123'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContextRunId(value)).toThrow(
        `Invalid run id "${value}". Expected a single non-empty run id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseContextRunId(undefined)).toThrow(
      'Invalid run id. Expected a single non-empty run id.',
    );
  });
});
