import { describe, expect, it } from 'vitest';
import {
  parseContextValidateLimit,
  parseContextValidateOffset,
  selectContextValidateIssues,
} from '../context.js';

describe('savestate context validate --limit', () => {
  it('defaults to undefined', () => {
    expect(parseContextValidateLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseContextValidateLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContextValidateLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseContextValidateLimit('1000')).toBe(1000);
    expect(() => parseContextValidateLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N validation issues', () => {
    expect(
      selectContextValidateIssues(
        [{ id: 'missing-run-id' }, { id: 'budget-exceeded' }, { id: 'no-facts' }],
        2,
      ).map((issue) => issue.id),
    ).toEqual(['missing-run-id', 'budget-exceeded']);
  });

  it('returns all issues when --limit is omitted', () => {
    const issues = [{ id: 'missing-run-id' }, { id: 'budget-exceeded' }];
    expect(selectContextValidateIssues(issues, undefined)).toEqual(issues);
  });

  it('pages issues with --offset before applying --limit', () => {
    const issues = [{ id: 'first' }, { id: 'second' }, { id: 'third' }];
    expect(selectContextValidateIssues(issues, 1, 1).map((issue) => issue.id)).toEqual(['second']);
  });

  it('parses and bounds --offset', () => {
    expect(parseContextValidateOffset(undefined)).toBeUndefined();
    expect(parseContextValidateOffset(' 2 ')).toBe(2);
    expect(() => parseContextValidateOffset('-1')).toThrow(
      'Invalid --offset value "-1". Expected a non-negative integer up to 1000.',
    );
    expect(() => parseContextValidateOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });
});
