import { describe, expect, it } from 'vitest';
import { formatAntibodiesStatsJson, type AntibodiesStatsJson } from '../antibodies.js';

const stats: AntibodiesStatsJson & { secret?: string } = {
  totalRules: 2,
  activeRules: 1,
  retiredRules: 1,
  totalHits: 9,
  totalOverrides: 1,
  rules: [
    {
      id: 'ab-write-eacces',
      risk: 'high',
      intervention: 'warn',
      active: true,
      confidence: 0.8,
      hits: 8,
      overrides: 0,
    },
    {
      id: 'ab-retry',
      risk: 'medium',
      intervention: 'warn',
      active: false,
      confidence: 0.5,
      hits: 1,
      overrides: 1,
    },
  ],
  secret: 'ss_live_SECRET',
};

describe('savestate antibodies stats --json', () => {
  it('prints stats as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesStatsJson(stats)) as AntibodiesStatsJson & {
      secret?: unknown;
      apiKey?: string;
    };
    expect(parsed).toEqual({
      totalRules: 2,
      activeRules: 1,
      retiredRules: 1,
      totalHits: 9,
      totalOverrides: 1,
      rules: [
        {
          id: 'ab-write-eacces',
          risk: 'high',
          intervention: 'warn',
          active: true,
          confidence: 0.8,
          hits: 8,
          overrides: 0,
        },
        {
          id: 'ab-retry',
          risk: 'medium',
          intervention: 'warn',
          active: false,
          confidence: 0.5,
          hits: 1,
          overrides: 1,
        },
      ],
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records empty stats without extra fields', () => {
    const parsed = JSON.parse(
      formatAntibodiesStatsJson({
        totalRules: 0,
        activeRules: 0,
        retiredRules: 0,
        totalHits: 0,
        totalOverrides: 0,
        rules: [],
      }),
    ) as AntibodiesStatsJson;
    expect(parsed.totalRules).toBe(0);
    expect(parsed.rules).toEqual([]);
    expect(Object.keys(parsed).sort()).toEqual([
      'activeRules',
      'retiredRules',
      'rules',
      'totalHits',
      'totalOverrides',
      'totalRules',
    ]);
  });
});
