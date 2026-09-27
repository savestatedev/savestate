import { describe, expect, it } from 'vitest';
import { parseTraceListLimit, selectTraceRuns } from '../trace.js';

describe('savestate trace list --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTraceListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTraceListLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTraceListLimit('1000')).toBe(1000);
    expect(() => parseTraceListLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N trace runs', () => {
    expect(
      selectTraceRuns(
        [{ runId: 'run-a' }, { runId: 'run-b' }, { runId: 'run-c' }],
        2,
      ).map((run) => run.runId),
    ).toEqual(['run-a', 'run-b']);
  });

  it('returns all runs when --limit is omitted', () => {
    const runs = [{ runId: 'run-a' }, { runId: 'run-b' }];
    expect(selectTraceRuns(runs, undefined)).toEqual(runs);
  });
});
