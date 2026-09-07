import { describe, expect, it } from 'vitest';
import { formatAntibodiesListJson, type AntibodiesListJson } from '../antibodies.js';

const result: AntibodiesListJson & { secret?: string } = {
  rules: [
    {
      id: 'ab-write-eacces',
      risk: 'high',
      intervention: 'warn',
      active: true,
      confidence: 0.8,
      hits: 8,
      overrides: 0,
      safeAction: 'check_permissions',
    },
    {
      id: 'ab-retry',
      risk: 'medium',
      intervention: 'warn',
      active: false,
      confidence: 0.5,
      hits: 1,
      overrides: 1,
      safeAction: 'retry_with_backoff',
    },
  ],
  secret: 'ss_live_SECRET',
};

describe('savestate antibodies list --json', () => {
  it('prints rules as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesListJson(result)) as AntibodiesListJson & {
      secret?: unknown;
      apiKey?: string;
    };
    expect(parsed).toEqual({
      rules: [
        {
          id: 'ab-write-eacces',
          risk: 'high',
          intervention: 'warn',
          active: true,
          confidence: 0.8,
          hits: 8,
          overrides: 0,
          safeAction: 'check_permissions',
        },
        {
          id: 'ab-retry',
          risk: 'medium',
          intervention: 'warn',
          active: false,
          confidence: 0.5,
          hits: 1,
          overrides: 1,
          safeAction: 'retry_with_backoff',
        },
      ],
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records an empty list without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesListJson({ rules: [] })) as AntibodiesListJson;
    expect(parsed.rules).toEqual([]);
    expect(Object.keys(parsed).sort()).toEqual(['rules']);
  });
});
