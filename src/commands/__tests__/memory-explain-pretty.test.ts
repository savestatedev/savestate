import { describe, expect, it } from 'vitest';
import {
  filterMemoryExplainByCriticality,
  formatMemoryExplainFreshness,
  formatMemoryExplainScoreBreakdown,
  formatMemoryExplainSource,
  getMemoryExplainCriticality,
  getMemoryListTags,
} from '../memory.js';

describe('savestate memory explain pretty freshness', () => {
  it('shows every score component exposed by JSON explanations', () => {
    expect(formatMemoryExplainScoreBreakdown({
      semanticSimilarity: 0.8,
      recencyDecay: 0.7,
      importance: 0.9,
      taskCriticality: 0.6,
      confidenceBoost: 1,
    })).toBe([
      '      • Semantic Similarity: 80.0% (weight: 25%)',
      '      • Task Criticality:    60.0% (weight: 45%)',
      '      • Importance:          90.0% (weight: 20%)',
      '      • Recency:             70.0% (weight: 10%)',
      '      • Confidence Boost:    100.0% (neutral)',
    ].join('\n'));
  });

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

  it('normalizes padding in the verification source', () => {
    const entry = {
      id: 'mem-789',
      content: 'A preference verified by an imported profile.',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      lastVerifiedAt: '2026-10-17T00:00:00.000Z',
      verificationSource: ' profile\t sync ',
      freshnessClass: 'slow' as const,
    };

    expect(formatMemoryExplainFreshness(entry, new Date('2026-10-18T00:00:00.000Z'))).toBe(
      'active (slow; verified 2026-10-17; source profile sync)',
    );
  });

  it('normalizes legacy padding in the source trace', () => {
    expect(formatMemoryExplainSource('  ChatGPT  ')).toBe('ChatGPT');
    expect(formatMemoryExplainSource(' Chat\t GPT ')).toBe('Chat GPT');
    expect(formatMemoryExplainSource('  ')).toBe('unknown');
  });

  it('normalizes imported tags before pretty source-trace output', () => {
    expect(getMemoryListTags({
      id: 'mem-tags',
      content: 'tagged preference',
      source: 'import',
      createdAt: '2026-10-01T00:00:00.000Z',
      metadata: { tags: [' Work ', 'urgent', 'work', '', 42] },
    })).toEqual(['Work', 'urgent']);
  });

  it('falls back when imported criticality metadata is not a finite score', () => {
    const entry = {
      id: 'mem-criticality',
      content: 'a preference with malformed ranking metadata',
      source: 'import',
      createdAt: '2026-10-01T00:00:00.000Z',
      metadata: { criticality: Number.NaN },
    };

    expect(getMemoryExplainCriticality(entry)).toBe(0.5);
  });

  it('accepts the checkpoint task_criticality metadata name', () => {
    const entry = {
      id: 'mem-checkpoint-criticality',
      content: 'a checkpoint memory with canonical ranking metadata',
      source: 'checkpoint',
      createdAt: '2026-10-01T00:00:00.000Z',
      metadata: { task_criticality: 0.85 },
    };

    expect(getMemoryExplainCriticality(entry)).toBe(0.85);
  });

  it('prefers canonical task_criticality when legacy metadata is also present', () => {
    const entry = {
      id: 'mem-checkpoint-criticality-precedence',
      content: 'a checkpoint memory with both ranking metadata names',
      source: 'checkpoint',
      createdAt: '2026-10-01T00:00:00.000Z',
      metadata: { criticality: 0.2, task_criticality: 0.85 },
    };

    expect(getMemoryExplainCriticality(entry)).toBe(0.85);
  });
});

describe('savestate memory explain criticality filter', () => {
  it('keeps the inclusive criticality range and defaults malformed metadata to 0.5', () => {
    const entries = [
      { id: 'low', content: 'query', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { criticality: 0.2 } },
      { id: 'default', content: 'query', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { criticality: 'invalid' } },
      { id: 'high', content: 'query', source: 'test', createdAt: '2026-10-01T00:00:00.000Z', metadata: { criticality: 0.9 } },
    ];

    expect(filterMemoryExplainByCriticality(entries, 0.5, 0.9).map(({ id }) => id)).toEqual(['default', 'high']);
  });
});
