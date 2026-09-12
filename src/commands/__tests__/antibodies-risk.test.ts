import { describe, expect, it } from 'vitest';
import { parseAntibodiesRisk } from '../antibodies.js';

describe('savestate antibodies add --risk', () => {
  it('defaults to medium', () => {
    expect(parseAntibodiesRisk(undefined)).toBe('medium');
  });

  it('accepts low, medium, high, and critical', () => {
    expect(parseAntibodiesRisk('low')).toBe('low');
    expect(parseAntibodiesRisk('medium')).toBe('medium');
    expect(parseAntibodiesRisk('HIGH')).toBe('high');
    expect(parseAntibodiesRisk('critical')).toBe('critical');
  });

  it.each(['', ' ', 'nope', 'urgent', '1'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesRisk(value)).toThrow(
      `Invalid --risk value "${value}". Expected one of: low, medium, high, critical.`,
    );
  });
});
