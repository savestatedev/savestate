import { describe, expect, it } from 'vitest';
import { parseTraceShowRunId } from '../trace.js';

describe('savestate trace show run_id', () => {
  it('accepts a single run id', () => {
    expect(parseTraceShowRunId('run_abc123')).toBe('run_abc123');
    expect(parseTraceShowRunId('run-2026-09-20')).toBe('run-2026-09-20');
    expect(parseTraceShowRunId(' run_abc123 ')).toBe('run_abc123');
  });

  it.each(['', ' ', ',', 'run_1,run_2', 'run abc123'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTraceShowRunId(value)).toThrow(
        `Invalid run id "${value}". Expected a single non-empty run id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseTraceShowRunId(undefined)).toThrow(
      'Invalid run id. Expected a single non-empty run id.',
    );
  });
});
