import { describe, expect, it } from 'vitest';
import {
  parseIdentityShowLimit,
  parseIdentityShowOffset,
  selectIdentityShowOffsetTools,
  selectIdentityShowTools,
} from '../identity.js';

describe('savestate identity show --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIdentityShowLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIdentityShowLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIdentityShowLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIdentityShowLimit('1000')).toBe(1000);
    expect(() => parseIdentityShowLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N identity tools', () => {
    expect(
      selectIdentityShowTools(
        [{ name: 'search' }, { name: 'browse' }, { name: 'write' }],
        2,
      ).map((tool) => tool.name),
    ).toEqual(['search', 'browse']);
  });

  it('returns all tools when --limit is omitted', () => {
    const tools = [{ name: 'search' }, { name: 'browse' }];
    expect(selectIdentityShowTools(tools, undefined)).toEqual(tools);
  });

  it('accepts a bounded non-negative offset', () => {
    expect(parseIdentityShowOffset(undefined)).toBeUndefined();
    expect(parseIdentityShowOffset('0')).toBe(0);
    expect(parseIdentityShowOffset('12')).toBe(12);
    expect(parseIdentityShowOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', '1001', 'nope'])('rejects invalid offset %s', (value) => {
    expect(() => parseIdentityShowOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('skips tools before applying a limit', () => {
    const tools = [{ name: 'search' }, { name: 'browse' }, { name: 'write' }];
    expect(selectIdentityShowTools(selectIdentityShowOffsetTools(tools, 1), 1)).toEqual([{ name: 'browse' }]);
  });
});
