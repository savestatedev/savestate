import { describe, expect, it } from 'vitest';
import {
  applyTraceExportFilters,
  parseTraceExportOffset,
  selectTraceExportOffsetRuns,
} from '../trace.js';

describe('savestate trace export --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTraceExportOffset(undefined)).toBeUndefined();
  });

  it('accepts non-negative integers', () => {
    expect(parseTraceExportOffset('0')).toBe(0);
    expect(parseTraceExportOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceExportOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('bounds the offset at 1000', () => {
    expect(parseTraceExportOffset('1000')).toBe(1000);
    expect(() => parseTraceExportOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N trace runs', () => {
    expect(
      selectTraceExportOffsetRuns(
        [{ runId: 'run-a' }, { runId: 'run-b' }, { runId: 'run-c' }],
        1,
      ).map((run) => run.runId),
    ).toEqual(['run-b', 'run-c']);
  });

  it('applies offset before limit', () => {
    expect(
      applyTraceExportFilters(
        [{ runId: 'run-a' }, { runId: 'run-b' }, { runId: 'run-c' }],
        { offset: '1', limit: '1' },
      ).map((run) => run.runId),
    ).toEqual(['run-b']);
  });
});
