import { describe, expect, it } from 'vitest';
import { parseContextTask } from '../context.js';

describe('savestate context --task', () => {
  it('accepts a non-empty task intent', () => {
    expect(parseContextTask('summarize inbox')).toBe('summarize inbox');
    expect(parseContextTask('Review PRs, then deploy')).toBe('Review PRs, then deploy');
    expect(parseContextTask(' summarize inbox ')).toBe('summarize inbox');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseContextTask(value)).toThrow(
      `Invalid --task value "${value}". Expected a non-empty task intent.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseContextTask(undefined)).toThrow(
      'Invalid --task value. Expected a non-empty task intent.',
    );
  });
});
