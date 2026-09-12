import { describe, expect, it } from 'vitest';
import { parseAntibodiesConfidence } from '../antibodies.js';

describe('savestate antibodies add --confidence', () => {
  it('defaults to 0.7', () => {
    expect(parseAntibodiesConfidence(undefined)).toBe(0.7);
  });

  it('accepts scores in 0..1', () => {
    expect(parseAntibodiesConfidence('0')).toBe(0);
    expect(parseAntibodiesConfidence('0.95')).toBe(0.95);
    expect(parseAntibodiesConfidence('1')).toBe(1);
  });

  it.each(['-0.1', '1.1', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesConfidence(value)).toThrow(
      `Invalid --confidence value "${value}". Expected a number between 0 and 1.`,
    );
  });
});
