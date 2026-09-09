import { describe, expect, it } from 'vitest';
import {
  formatExportMissingJson,
  type ExportMissingJson,
} from '../container.js';

describe('savestate export --json when missing', () => {
  it('prints a missing export summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatExportMissingJson('missing-dir/agent.savestate')) as ExportMissingJson & {
      checksum?: unknown;
      components?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      output: 'missing-dir/agent.savestate',
      written: false,
      agent: null,
    });
    expect(parsed.checksum).toBeUndefined();
    expect(parsed.components).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['agent', 'found', 'output', 'written']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
