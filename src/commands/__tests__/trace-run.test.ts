import { describe, expect, it } from 'vitest';
import { parseTraceRun } from '../trace.js';

describe('savestate trace --run', () => {
  it('defaults to undefined', () => {
    expect(parseTraceRun(undefined)).toBeUndefined();
  });

  it('accepts a single run id', () => {
    expect(parseTraceRun('run-123')).toBe('run-123');
    expect(parseTraceRun('run.abc_def')).toBe('run.abc_def');
    expect(parseTraceRun(' run-1 ')).toBe('run-1');
  });

  it.each(['', ' ', ',', 'run-1,run-2', 'run 1'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceRun(value)).toThrow(
      `Invalid --run value "${value}". Expected a single non-empty run id.`,
    );
  });
});
