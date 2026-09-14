import { describe, expect, it } from 'vitest';
import { parseAntibodiesId } from '../antibodies.js';

describe('savestate antibodies --id', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesId(undefined)).toBeUndefined();
  });

  it('accepts a single rule id', () => {
    expect(parseAntibodiesId('rule-write-eacces')).toBe('rule-write-eacces');
    expect(parseAntibodiesId('ab.cd_ef')).toBe('ab.cd_ef');
    expect(parseAntibodiesId(' rule-1 ')).toBe('rule-1');
  });

  it.each(['', ' ', ',', 'rule-1,rule-2', 'rule 1'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesId(value)).toThrow(
      `Invalid --id value "${value}". Expected a single non-empty rule id.`,
    );
  });
});
