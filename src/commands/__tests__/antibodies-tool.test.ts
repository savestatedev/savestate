import { describe, expect, it } from 'vitest';
import { parseAntibodiesTool } from '../antibodies.js';

describe('savestate antibodies --tool', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesTool(undefined)).toBeUndefined();
  });

  it('accepts a single tool name', () => {
    expect(parseAntibodiesTool('write')).toBe('write');
    expect(parseAntibodiesTool('fs.write_file')).toBe('fs.write_file');
    expect(parseAntibodiesTool(' Write ')).toBe('Write');
  });

  it.each(['', ' ', ',', 'write,read', 'write file'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesTool(value)).toThrow(
      `Invalid --tool value "${value}". Expected a single non-empty tool name.`,
    );
  });
});
