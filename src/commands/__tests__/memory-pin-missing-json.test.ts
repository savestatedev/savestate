import { describe, expect, it } from 'vitest';
import {
  formatMemoryPinMissingJson,
  type MemoryPinMissingJson,
} from '../memory.js';

describe('savestate memory pin --json when missing', () => {
  it('prints a missing memory pin summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryPinMissingJson('mem-missing')) as MemoryPinMissingJson & {
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
