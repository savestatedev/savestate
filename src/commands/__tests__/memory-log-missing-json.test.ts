import { describe, expect, it } from 'vitest';
import {
  formatMemoryLogMissingJson,
  type MemoryLogMissingJson,
} from '../memory-lifecycle.js';

describe('savestate memory log --json when missing', () => {
  it('prints a missing memory log summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryLogMissingJson('mem-missing')) as MemoryLogMissingJson & {
      memoryId?: unknown;
      content?: unknown;
      previous_content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'mem-missing',
      events: null,
    });
    expect(parsed.memoryId).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['events', 'found', 'id']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
