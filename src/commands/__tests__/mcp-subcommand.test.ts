import { describe, expect, it } from 'vitest';
import { parseMcpSubcommand } from '../mcp.js';

describe('savestate mcp subcommand', () => {
  it('accepts a single mcp subcommand', () => {
    expect(parseMcpSubcommand('serve')).toBe('serve');
    expect(parseMcpSubcommand('status')).toBe('status');
    expect(parseMcpSubcommand('export')).toBe('export');
    expect(parseMcpSubcommand('import')).toBe('import');
    expect(parseMcpSubcommand(' SERVE ')).toBe('serve');
  });

  it('defaults a missing value to serve', () => {
    expect(parseMcpSubcommand(undefined)).toBe('serve');
  });

  it.each(['', ' ', ',', 'serve,status', 'mcp serve', 'quality'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseMcpSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty mcp subcommand (serve, status, export, import).`,
      );
    },
  );
});
