import { describe, expect, it } from 'vitest';
import { parseVerifyFile } from '../verify.js';

describe('savestate verify file', () => {
  it('accepts a single path', () => {
    expect(parseVerifyFile('agent.savestate')).toBe('agent.savestate');
    expect(parseVerifyFile('./agent.savestate')).toBe('./agent.savestate');
    expect(parseVerifyFile(' agent.savestate ')).toBe('agent.savestate');
  });

  it.each(['', ' ', ',', 'a.savestate,b.savestate', 'agent savestate'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseVerifyFile(value)).toThrow(
        `Invalid file "${value}". Expected a single non-empty path.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseVerifyFile(undefined)).toThrow(
      'Invalid file. Expected a single non-empty path.',
    );
  });
});
