import { describe, expect, it } from 'vitest';
import {
  formatMcpImportMissingJson,
  type McpImportMissingJson,
} from '../mcp.js';

describe('savestate mcp import --json when missing', () => {
  it('prints a missing passport import summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMcpImportMissingJson('passport.json')) as McpImportMissingJson & {
      sourceAgent?: unknown;
      targetAgent?: unknown;
      merge?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      input: 'passport.json',
      importedMemories: 0,
      totalMemories: 0,
      snapshots: 0,
    });
    expect(parsed.sourceAgent).toBeUndefined();
    expect(parsed.targetAgent).toBeUndefined();
    expect(parsed.merge).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'importedMemories',
      'input',
      'snapshots',
      'totalMemories',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
