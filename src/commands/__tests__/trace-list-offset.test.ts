import { describe, expect, it } from 'vitest';
import {
  parseTraceListOffset,
  selectTraceRunOffset,
} from '../trace.js';

describe('savestate trace list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTraceListOffset(undefined)).toBeUndefined();
  });

  it('accepts non-negative integers', () => {
    expect(parseTraceListOffset('0')).toBe(0);
    expect(parseTraceListOffset('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseTraceListOffset('\t3\n')).toBe(3);
  });

  it.each(['', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('bounds the offset at 1000', () => {
    expect(parseTraceListOffset('1000')).toBe(1000);
    expect(() => parseTraceListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N trace runs', () => {
    expect(
      selectTraceRunOffset(
        [{ runId: 'run-a' }, { runId: 'run-b' }, { runId: 'run-c' }],
        1,
      ).map((run) => run.runId),
    ).toEqual(['run-b', 'run-c']);
  });
});
