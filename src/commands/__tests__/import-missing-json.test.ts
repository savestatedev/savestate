import { describe, expect, it } from 'vitest';
import {
  formatImportMissingJson,
  type ImportMissingJson,
} from '../container.js';

describe('savestate import --json when missing', () => {
  it('prints a missing import summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatImportMissingJson('missing.savestate')) as ImportMissingJson & {
      checksum?: unknown;
      components?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      input: 'missing.savestate',
      restored: false,
      agent: null,
    });
    expect(parsed.checksum).toBeUndefined();
    expect(parsed.components).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['agent', 'found', 'input', 'restored']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
