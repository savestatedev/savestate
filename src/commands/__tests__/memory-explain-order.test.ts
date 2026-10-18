import { describe, expect, it } from 'vitest';
import { sortMemoryExplainResults } from '../memory.js';

describe('savestate memory explain result ordering', () => {
  it('breaks equal-score ties by newest creation date and then id', () => {
    const results = [
      { entry: { id: 'zeta', createdAt: '2026-10-17T12:00:00.000Z' }, finalScore: 0.5 },
      { entry: { id: 'beta', createdAt: '2026-10-18T12:00:00.000Z' }, finalScore: 0.5 },
      { entry: { id: 'alpha', createdAt: '2026-10-18T12:00:00.000Z' }, finalScore: 0.5 },
      { entry: { id: 'best', createdAt: '2026-10-01T12:00:00.000Z' }, finalScore: 0.9 },
    ];

    expect(sortMemoryExplainResults(results).map((result) => result.entry.id)).toEqual([
      'best',
      'alpha',
      'beta',
      'zeta',
    ]);
  });
});
