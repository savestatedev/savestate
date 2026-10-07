import { describe, expect, it } from 'vitest';
import {
  parseTraceShowLimit,
  parseTraceShowOffset,
  selectTraceShowEvents,
  selectTraceShowOffset,
} from '../trace.js';

describe('savestate trace show --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTraceShowLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTraceShowLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceShowLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTraceShowLimit('1000')).toBe(1000);
    expect(() => parseTraceShowLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N trace events', () => {
    expect(
      selectTraceShowEvents(
        [{ eventType: 'tool' }, { eventType: 'result' }, { eventType: 'error' }],
        2,
      ).map((event) => event.eventType),
    ).toEqual(['tool', 'result']);
  });

  it('returns all events when --limit is omitted', () => {
    const events = [{ eventType: 'tool' }, { eventType: 'result' }];
    expect(selectTraceShowEvents(events, undefined)).toEqual(events);
  });

  it('accepts non-negative event offsets', () => {
    expect(parseTraceShowOffset(undefined)).toBeUndefined();
    expect(parseTraceShowOffset('0')).toBe(0);
    expect(parseTraceShowOffset('12')).toBe(12);
  });

  it.each(['', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid event offset %s', (value) => {
    expect(() => parseTraceShowOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('bounds event offsets and skips events', () => {
    expect(parseTraceShowOffset('1000')).toBe(1000);
    expect(() => parseTraceShowOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
    expect(
      selectTraceShowOffset(
        [{ eventType: 'tool' }, { eventType: 'result' }, { eventType: 'error' }],
        1,
      ).map((event) => event.eventType),
    ).toEqual(['result', 'error']);
  });
});
