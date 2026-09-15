import { describe, expect, it } from 'vitest';
import { parseContextFile } from '../context.js';

describe('savestate context --file', () => {
  it('defaults to undefined', () => {
    expect(parseContextFile(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseContextFile('brief.json')).toBe('brief.json');
    expect(parseContextFile('./briefs/run.json')).toBe('./briefs/run.json');
    expect(parseContextFile(' brief.json ')).toBe('brief.json');
  });

  it.each(['', ' ', ',', 'a.json,b.json', 'brief.json other.json'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContextFile(value)).toThrow(
        `Invalid --file value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
