import { describe, expect, it } from 'vitest';
import {
  formatMemoryDeleteMissingJson,
  type MemoryDeleteMissingJson,
} from '../memory-lifecycle.js';

describe('savestate memory delete --json when missing', () => {
  it('prints a missing memory delete summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryDeleteMissingJson('mem-missing')) as MemoryDeleteMissingJson & {
      reason?: unknown;
      actorId?: unknown;
      content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'mem-missing',
      deleted: null,
    });
    expect(parsed.reason).toBeUndefined();
    expect(parsed.actorId).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['deleted', 'found', 'id']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
