import { describe, expect, it } from 'vitest';
import { formatMemoryExplainFreshness, formatMemoryExplainSource } from '../memory.js';

describe('savestate memory explain pretty freshness', () => {
  it('returns the current freshness state for human-facing output', () => {
    const entry = {
      id: 'mem-123',
      content: 'A preference worth remembering.',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      freshnessClass: 'fast' as const,
    };

    expect(formatMemoryExplainFreshness(entry, new Date('2026-10-18T00:00:00.000Z'))).toBe(
      'needs confirmation (fast; verified 2026-10-01)',
    );
  });

  it('includes the verification source when one is recorded', () => {
    const entry = {
      id: 'mem-456',
      content: 'A preference verified by a profile sync.',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      lastVerifiedAt: '2026-10-17T00:00:00.000Z',
      verificationSource: 'profile-sync',
      freshnessClass: 'slow' as const,
    };

    expect(formatMemoryExplainFreshness(entry, new Date('2026-10-18T00:00:00.000Z'))).toBe(
      'active (slow; verified 2026-10-17; source profile-sync)',
    );
  });

  it('normalizes legacy padding in the source trace', () => {
    expect(formatMemoryExplainSource('  ChatGPT  ')).toBe('ChatGPT');
    expect(formatMemoryExplainSource(' Chat\t GPT ')).toBe('Chat GPT');
    expect(formatMemoryExplainSource('  ')).toBe('unknown');
  });
});
