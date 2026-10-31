import { describe, expect, it } from 'vitest';
import {
  parseMemoryMaxCriticality,
  parseMemoryMinCriticality,
  validateMemoryScoreRange,
} from '../memory-cli.js';

describe('savestate memory explain criticality options', () => {
  it('accepts bounded decimal criticality scores', () => {
    expect(parseMemoryMinCriticality(' 0.8 ')).toBe(0.8);
    expect(parseMemoryMaxCriticality('1')).toBe(1);
  });

  it.each(['', '1.1', '-0.1', 'high'])('rejects invalid minimum criticality %j', (value) => {
    expect(() => parseMemoryMinCriticality(value)).toThrow(
      `Invalid --min-criticality value "${value}". Expected a number between 0 and 1.`,
    );
  });

  it('rejects an inverted range with a criticality-specific message', () => {
    expect(() => validateMemoryScoreRange(0.9, 0.2, 'criticality')).toThrow(
      'Invalid memory criticality range: --min-criticality (0.9) must be at or below --max-criticality (0.2).',
    );
  });
});
