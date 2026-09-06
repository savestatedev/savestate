import { describe, expect, it } from 'vitest';
import {
  formatMemoryUnpinJson,
  type MemoryUnpinJson,
} from '../memory.js';

describe('savestate memory unpin --json', () => {
  it('prints pinned status as JSON', () => {
    const parsed = JSON.parse(formatMemoryUnpinJson('mem-123')) as MemoryUnpinJson & {
      alreadyUnpinned?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      pinned: false,
    });
    expect(parsed.alreadyUnpinned).toBeUndefined();
  });

  it('records a second memory id as unpinned', () => {
    const parsed = JSON.parse(formatMemoryUnpinJson('mem-456')) as MemoryUnpinJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.pinned).toBe(false);
  });
});
