import { describe, expect, it } from 'vitest';
import { formatMemoryListTierSummary } from '../memory.js';

describe('savestate memory list tier summary', () => {
  it('renders each tier exactly once', () => {
    expect(formatMemoryListTierSummary({ L1: 2, L2: 5, L3: 9 })).toBe(
      '  L1 (short-term):  2 items\n' +
      '  L2 (working set): 5 items\n' +
      '  L3 (archive):     9 items',
    );
  });
});
