import { describe, expect, it } from 'vitest';
import { parseContextBudget } from '../context.js';

describe('savestate context compile --budget', () => {
  it('defaults to 4000 tokens', () => {
    expect(parseContextBudget(undefined)).toBe(4000);
  });

  it('accepts positive integers', () => {
    expect(parseContextBudget('12')).toBe(12);
    expect(parseContextBudget('4000')).toBe(4000);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContextBudget(value)).toThrow(
      `Invalid --budget value "${value}". Expected a positive integer up to 1000000.`,
    );
  });

  it('rejects values above the bounded token budget', () => {
    expect(parseContextBudget('1000000')).toBe(1000000);
    expect(() => parseContextBudget('1000001')).toThrow(
      'Invalid --budget value "1000001". Expected a positive integer up to 1000000.',
    );
  });
});
