import { describe, expect, it } from 'vitest';
import { parseMcpAgent } from '../mcp.js';

describe('savestate mcp --agent', () => {
  it('defaults to undefined', () => {
    expect(parseMcpAgent(undefined)).toBeUndefined();
  });

  it('accepts a single agent id', () => {
    expect(parseMcpAgent('default')).toBe('default');
    expect(parseMcpAgent('my-agent')).toBe('my-agent');
    expect(parseMcpAgent(' other-agent ')).toBe('other-agent');
  });

  it.each(['', ' ', ',', 'my-agent,other-agent', 'my agent'])('rejects invalid value %s', (value) => {
    expect(() => parseMcpAgent(value)).toThrow(
      `Invalid --agent value "${value}". Expected a single non-empty agent id.`,
    );
  });
});
