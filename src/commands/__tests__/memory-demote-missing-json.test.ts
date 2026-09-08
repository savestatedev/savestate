import { describe, expect, it } from 'vitest';
import {
  formatMemoryDemoteMissingJson,
  type MemoryDemoteMissingJson,
} from '../memory.js';

describe('savestate memory demote --json when missing', () => {
  it('prints a missing memory demote summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryDemoteMissingJson('mem-missing')) as MemoryDemoteMissingJson & {
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
