import { describe, expect, it } from 'vitest';
import {
  formatMemoryPinJson,
  type MemoryPinJson,
} from '../memory.js';

describe('savestate memory pin --json', () => {
  it('prints pinned status as JSON', () => {
    const parsed = JSON.parse(formatMemoryPinJson('mem-123')) as MemoryPinJson & {
      alreadyPinned?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      pinned: true,
    });
    expect(parsed.alreadyPinned).toBeUndefined();
  });

  it('records a second memory id as pinned', () => {
    const parsed = JSON.parse(formatMemoryPinJson('mem-456')) as MemoryPinJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.pinned).toBe(true);
  });
});
