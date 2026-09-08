import { describe, expect, it } from 'vitest';
import {
  formatMcpExportMissingJson,
  type McpExportMissingJson,
} from '../mcp.js';

describe('savestate mcp export --json when missing', () => {
  it('prints a missing passport export summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatMcpExportMissingJson('my-agent', 'passport-my-agent.json'),
    ) as McpExportMissingJson & {
      includeSnapshots?: unknown;
      secret?: unknown;
      apiKey?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      agent: 'my-agent',
      output: 'passport-my-agent.json',
      memories: 0,
      snapshots: 0,
      written: false,
    });
    expect(parsed.includeSnapshots).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'agent',
      'found',
      'memories',
      'output',
      'snapshots',
      'written',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
