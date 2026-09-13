import { describe, expect, it } from 'vitest';
import { parseMcpPort } from '../mcp.js';

describe('savestate mcp serve --port', () => {
  it('defaults to 3333', () => {
    expect(parseMcpPort(undefined)).toBe(3333);
  });

  it('accepts TCP port integers', () => {
    expect(parseMcpPort('1')).toBe(1);
    expect(parseMcpPort('8080')).toBe(8080);
    expect(parseMcpPort('65535')).toBe(65535);
  });

  it.each(['0', '-1', '1.5', 'nope', '', '65536', '123abc'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpPort(value)).toThrow(
      `Invalid --port value "${value}". Expected an integer from 1 to 65535.`,
    );
  });
});
