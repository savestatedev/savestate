import { describe, expect, it } from 'vitest';
import { parseMcpInput } from '../mcp.js';

describe('savestate mcp --input', () => {
  it('defaults to undefined', () => {
    expect(parseMcpInput(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseMcpInput('passport.json')).toBe('passport.json');
    expect(parseMcpInput('./exports/passport.json')).toBe('./exports/passport.json');
    expect(parseMcpInput(' passport.json ')).toBe('passport.json');
  });

  it.each(['', ' ', ',', 'a.json,b.json', 'passport.json other.json'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseMcpInput(value)).toThrow(
        `Invalid --input value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
