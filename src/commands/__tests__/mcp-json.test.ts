import { describe, expect, it } from 'vitest';
import { formatMcpStatusJson, type McpStatus } from '../mcp.js';

const status: McpStatus = {
  initialized: true,
  enabled: true,
  port: 3333,
  auth: 'none',
  tools: [
    'savestate_snapshot',
    'savestate_restore',
    'savestate_list',
    'savestate_status',
    'savestate_memory_store',
    'savestate_memory_search',
    'savestate_memory_delete',
  ],
  resources: ['savestate://snapshots', 'savestate://memories'],
};

describe('savestate mcp status --json', () => {
  it('prints MCP status as JSON', () => {
    const parsed = JSON.parse(formatMcpStatusJson(status)) as McpStatus;
    expect(parsed.initialized).toBe(true);
    expect(parsed.enabled).toBe(true);
    expect(parsed.port).toBe(3333);
    expect(parsed.auth).toBe('none');
    expect(parsed.tools).toContain('savestate_memory_search');
    expect(parsed.resources).toEqual(['savestate://snapshots', 'savestate://memories']);
    expect(parsed.pagination).toEqual({
      tools: {
        offset: 0,
        limit: null,
        total: 7,
        shown: 7,
        hasMore: false,
        nextOffset: null,
      },
      resources: {
        offset: 0,
        limit: null,
        total: 2,
        shown: 2,
        hasMore: false,
        nextOffset: null,
      },
    });
  });

  it('records an uninitialized MCP status', () => {
    const parsed = JSON.parse(
      formatMcpStatusJson({
        ...status,
        initialized: false,
        enabled: false,
      }),
    ) as McpStatus;
    expect(parsed.initialized).toBe(false);
    expect(parsed.enabled).toBe(false);
    expect(parsed.port).toBe(3333);
  });
});
