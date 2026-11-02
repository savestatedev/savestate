import { describe, expect, it } from 'vitest';
import { formatUnknownMcpToolResult } from '../server.js';

describe('unknown MCP tools', () => {
  it('returns an MCP error response instead of a successful result', () => {
    expect(formatUnknownMcpToolResult('missing_tool')).toEqual({
      content: [{ type: 'text', text: 'Unknown tool: missing_tool' }],
      isError: true,
    });
  });
});
