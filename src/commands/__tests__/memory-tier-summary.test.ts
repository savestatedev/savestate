import { describe, expect, it } from 'vitest';
import {
  formatMemoryListPageRemainingSummary,
  formatMemoryListPageTierSummary,
  formatMemoryListTierSummary,
} from '../memory.js';

describe('savestate memory list tier summary', () => {
  it('renders each tier exactly once', () => {
    expect(formatMemoryListTierSummary({ L1: 2, L2: 5, L3: 9 })).toBe(
      '  L1 (short-term):  2 items\n' +
      '  L2 (working set): 5 items\n' +
      '  L3 (archive):     9 items',
    );
  });

  it('renders the tier breakdown for a visible page', () => {
    expect(formatMemoryListPageTierSummary([
      { id: 'l1', content: 'one', source: 'test', createdAt: '2026-01-01', tier: 'L1' },
      { id: 'l2', content: 'two', source: 'test', createdAt: '2026-01-01', tier: 'L2' },
      { id: 'l3', content: 'three', source: 'test', createdAt: '2026-01-01' },
    ])).toBe('Page Tiers: L1 1, L2 1, L3 1');
  });

  it('renders the number of matching memories after the visible page', () => {
    expect(formatMemoryListPageRemainingSummary(12, 5, 5)).toBe(
      'Page Remaining: 2 matching memories',
    );
  });
});
