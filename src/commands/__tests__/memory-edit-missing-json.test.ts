import { describe, expect, it } from 'vitest';
import {
  formatMemoryEditMissingJson,
  type MemoryEditMissingJson,
} from '../memory-lifecycle.js';

describe('savestate memory edit --json when missing', () => {
  it('prints a missing memory edit summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryEditMissingJson('mem-missing')) as MemoryEditMissingJson & {
      content?: unknown;
      tags?: unknown;
      importance?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'mem-missing',
      version: null,
    });
    expect(parsed.content).toBeUndefined();
    expect(parsed.tags).toBeUndefined();
    expect(parsed.importance).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'id', 'version']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
