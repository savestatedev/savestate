import { describe, expect, it } from 'vitest';
import {
  formatMemoryPromoteJson,
  type MemoryPromoteJson,
} from '../memory.js';

describe('savestate memory promote --json', () => {
  it('prints from/to tiers as JSON', () => {
    const parsed = JSON.parse(formatMemoryPromoteJson('mem-123', 'L3', 'L1')) as MemoryPromoteJson & {
      previousTier?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      from: 'L3',
      to: 'L1',
    });
    expect(parsed.previousTier).toBeUndefined();
  });

  it('records an L2 to L1 promotion', () => {
    const parsed = JSON.parse(formatMemoryPromoteJson('mem-456', 'L2', 'L1')) as MemoryPromoteJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.from).toBe('L2');
    expect(parsed.to).toBe('L1');
  });
});
