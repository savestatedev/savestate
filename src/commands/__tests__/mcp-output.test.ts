import { describe, expect, it } from 'vitest';
import { parseMcpOutput } from '../mcp.js';

describe('savestate mcp --output', () => {
  it('defaults to undefined', () => {
    expect(parseMcpOutput(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseMcpOutput('passport.json')).toBe('passport.json');
    expect(parseMcpOutput('./exports/passport.json')).toBe('./exports/passport.json');
    expect(parseMcpOutput(' passport.json ')).toBe('passport.json');
  });

  it.each(['', ' ', ',', 'a.json,b.json', 'passport.json other.json'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseMcpOutput(value)).toThrow(
        `Invalid --output value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
