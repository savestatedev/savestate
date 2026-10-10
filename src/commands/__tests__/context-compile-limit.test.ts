import { describe, expect, it } from 'vitest';
import {
  parseContextCompileLimit,
  parseContextCompileOffset,
  selectContextCompileEntries,
} from '../context.js';

describe('savestate context compile --limit', () => {
  it('defaults to undefined', () => {
    expect(parseContextCompileLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseContextCompileLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContextCompileLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseContextCompileLimit('1000')).toBe(1000);
    expect(() => parseContextCompileLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N RunBrief section rows', () => {
    expect(
      selectContextCompileEntries(
        [{ id: 'must_know_facts' }, { id: 'active_state' }, { id: 'open_loops' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['must_know_facts', 'active_state']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'must_know_facts' }, { id: 'active_state' }];
    expect(selectContextCompileEntries(entries, undefined)).toEqual(entries);
  });

  it('pages section rows with --offset before applying --limit', () => {
    expect(
      selectContextCompileEntries(
        [{ id: 'must_know_facts' }, { id: 'active_state' }, { id: 'open_loops' }],
        1,
        1,
      ).map((entry) => entry.id),
    ).toEqual(['active_state']);
  });

  it('validates --offset as a bounded non-negative integer', () => {
    expect(parseContextCompileOffset(undefined)).toBeUndefined();
    expect(parseContextCompileOffset('0')).toBe(0);
    expect(parseContextCompileOffset('1000')).toBe(1000);
    expect(() => parseContextCompileOffset('-1')).toThrow();
    expect(() => parseContextCompileOffset('1001')).toThrow();
  });
});
