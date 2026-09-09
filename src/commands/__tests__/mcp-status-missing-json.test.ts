import { describe, expect, it } from 'vitest';
import {
  formatMcpStatusMissingJson,
  type McpStatusMissingJson,
} from '../mcp.js';

describe('savestate mcp status --json when missing', () => {
  it('prints a missing MCP status summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMcpStatusMissingJson()) as McpStatusMissingJson & {
      tools?: unknown;
      resources?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      initialized: false,
      enabled: false,
    });
    expect(parsed.tools).toBeUndefined();
    expect(parsed.resources).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['enabled', 'found', 'initialized']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
