import { describe, expect, it } from 'vitest';
import { parseContainerDescription } from '../container.js';

describe('savestate export --description', () => {
  it('defaults to undefined', () => {
    expect(parseContainerDescription(undefined)).toBeUndefined();
  });

  it('accepts a non-empty description', () => {
    expect(parseContainerDescription('weekly backup')).toBe('weekly backup');
    expect(parseContainerDescription('includes tools, memory')).toBe('includes tools, memory');
    expect(parseContainerDescription(' weekly backup ')).toBe('weekly backup');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseContainerDescription(value)).toThrow(
      `Invalid --description value "${value}". Expected a non-empty description.`,
    );
  });
});
