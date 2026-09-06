import { describe, expect, it } from 'vitest';
import {
  formatMemoryDemoteJson,
  type MemoryDemoteJson,
} from '../memory.js';

describe('savestate memory demote --json', () => {
  it('prints from/to tiers as JSON', () => {
    const parsed = JSON.parse(formatMemoryDemoteJson('mem-123', 'L1', 'L3')) as MemoryDemoteJson & {
      previousTier?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      from: 'L1',
      to: 'L3',
    });
    expect(parsed.previousTier).toBeUndefined();
  });

  it('records an L2 to L3 demotion', () => {
    const parsed = JSON.parse(formatMemoryDemoteJson('mem-456', 'L2', 'L3')) as MemoryDemoteJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.from).toBe('L2');
    expect(parsed.to).toBe('L3');
  });
});
