import { describe, expect, it } from 'vitest';
import {
  formatMemoryPromoteMissingJson,
  type MemoryPromoteMissingJson,
} from '../memory.js';

describe('savestate memory promote --json when missing', () => {
  it('prints a missing memory promote summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryPromoteMissingJson('mem-missing')) as MemoryPromoteMissingJson & {
      previousTier?: unknown;
      content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'mem-missing',
      from: null,
      to: null,
    });
    expect(parsed.previousTier).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'from', 'id', 'to']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
