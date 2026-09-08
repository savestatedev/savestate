import { describe, expect, it } from 'vitest';
import {
  formatMemoryUnpinMissingJson,
  type MemoryUnpinMissingJson,
} from '../memory.js';

describe('savestate memory unpin --json when missing', () => {
  it('prints a missing memory unpin summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryUnpinMissingJson('mem-missing')) as MemoryUnpinMissingJson & {
      alreadyPinned?: unknown;
      content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'mem-missing',
      pinned: null,
    });
    expect(parsed.alreadyPinned).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'id', 'pinned']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
