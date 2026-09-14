import { describe, expect, it } from 'vitest';
import { parseAntibodiesTags } from '../antibodies.js';

describe('savestate antibodies --tags', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesTags(undefined)).toBeUndefined();
  });

  it('accepts one or more antibody tags', () => {
    expect(parseAntibodiesTags('write')).toEqual(['write']);
    expect(parseAntibodiesTags('important,v2')).toEqual(['important', 'v2']);
    expect(parseAntibodiesTags(' Weekly , Backup ')).toEqual(['weekly', 'backup']);
  });

  it.each(['', ' ', ',', 'write,', ',v2', 'a,,b'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesTags(value)).toThrow(
      `Invalid --tags value "${value}". Expected one or more non-empty antibody tags (comma-separated).`,
    );
  });
});
