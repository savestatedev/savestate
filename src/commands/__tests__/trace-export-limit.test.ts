import { describe, expect, it } from 'vitest';
import { parseTraceExportLimit, selectTraceExportRuns } from '../trace.js';

describe('savestate trace export --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTraceExportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTraceExportLimit('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseTraceExportLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceExportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTraceExportLimit('1000')).toBe(1000);
    expect(() => parseTraceExportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N trace runs', () => {
    expect(
      selectTraceExportRuns(
        [{ runId: 'run-a' }, { runId: 'run-b' }, { runId: 'run-c' }],
        2,
      ).map((run) => run.runId),
    ).toEqual(['run-a', 'run-b']);
  });

  it('returns all runs when --limit is omitted', () => {
    const runs = [{ runId: 'run-a' }, { runId: 'run-b' }];
    expect(selectTraceExportRuns(runs, undefined)).toEqual(runs);
  });
});
