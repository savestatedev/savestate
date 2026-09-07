import { describe, expect, it } from 'vitest';
import type { CompatibilityReport } from '../../migrate/types.js';
import { formatMigrateDryRunJson, type MigrateDryRunJson } from '../migrate.js';

const report: CompatibilityReport & { secret?: string; bundle?: unknown } = {
  source: 'chatgpt',
  target: 'claude',
  generatedAt: '2026-09-07T15:00:00.000Z',
  feasibility: 'moderate',
  summary: {
    perfect: 2,
    adapted: 1,
    incompatible: 1,
    total: 4,
  },
  items: [
    {
      type: 'instructions',
      name: 'Custom instructions',
      status: 'perfect',
      reason: 'Fits Claude system prompt',
      action: 'keep',
      sourceRef: '/Users/me/.chatgpt/ss_live_SECRET.md',
    },
    {
      type: 'memory',
      name: 'Core memory',
      status: 'incompatible',
      reason: 'Claude has no explicit memory',
    },
  ],
  recommendations: ['Export memories as a markdown file'],
  secret: 'ss_live_SECRET',
  bundle: { apiKey: 'ss_live_SECRET' },
};

describe('savestate migrate --dry-run --json', () => {
  it('prints a compatibility report as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMigrateDryRunJson(report)) as MigrateDryRunJson & {
      secret?: unknown;
      apiKey?: string;
      bundle?: unknown;
      sourceRef?: unknown;
    };
    expect(parsed).toEqual({
      source: 'chatgpt',
      target: 'claude',
      generatedAt: '2026-09-07T15:00:00.000Z',
      feasibility: 'moderate',
      summary: {
        perfect: 2,
        adapted: 1,
        incompatible: 1,
        total: 4,
      },
      items: [
        {
          type: 'instructions',
          name: 'Custom instructions',
          status: 'perfect',
          reason: 'Fits Claude system prompt',
          action: 'keep',
        },
        {
          type: 'memory',
          name: 'Core memory',
          status: 'incompatible',
          reason: 'Claude has no explicit memory',
          action: null,
        },
      ],
      recommendations: ['Export memories as a markdown file'],
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.bundle).toBeUndefined();
    expect(parsed.sourceRef).toBeUndefined();
    expect(parsed.items[0]).not.toHaveProperty('sourceRef');
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records an empty report without extra fields', () => {
    const parsed = JSON.parse(
      formatMigrateDryRunJson({
        source: 'claude',
        target: 'gemini',
        generatedAt: '2026-09-07T16:00:00.000Z',
        feasibility: 'easy',
        summary: {
          perfect: 0,
          adapted: 0,
          incompatible: 0,
          total: 0,
        },
        items: [],
        recommendations: [],
      }),
    ) as MigrateDryRunJson;
    expect(parsed.source).toBe('claude');
    expect(parsed.target).toBe('gemini');
    expect(parsed.feasibility).toBe('easy');
    expect(parsed.items).toEqual([]);
    expect(parsed.recommendations).toEqual([]);
    expect(parsed.summary.total).toBe(0);
    expect(Object.keys(parsed).sort()).toEqual([
      'feasibility',
      'generatedAt',
      'items',
      'recommendations',
      'source',
      'summary',
      'target',
    ]);
  });
});
