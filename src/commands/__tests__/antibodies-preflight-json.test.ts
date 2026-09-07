import { describe, expect, it } from 'vitest';
import { formatAntibodiesPreflightJson, type AntibodiesPreflightJson } from '../antibodies.js';

const result: AntibodiesPreflightJson & { secret?: string } = {
  blocked: false,
  elapsedMs: 12,
  semanticUsed: true,
  warnings: [
    {
      ruleId: 'ab-write-eacces',
      risk: 'high',
      intervention: 'warn',
      confidence: 0.8,
      safeAction: 'check_permissions',
      reasons: ['tool', 'path_prefix'],
    },
    {
      ruleId: 'ab-retry',
      risk: 'medium',
      intervention: 'confirm',
      confidence: 0.5,
      safeAction: 'retry_with_backoff',
      reasons: ['error_code'],
    },
  ],
  secret: 'ss_live_SECRET',
};

describe('savestate antibodies preflight --json', () => {
  it('prints preflight as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesPreflightJson(result)) as AntibodiesPreflightJson & {
      secret?: unknown;
      apiKey?: string;
      matchedRuleIds?: string[];
    };
    expect(parsed).toEqual({
      blocked: false,
      elapsedMs: 12,
      semanticUsed: true,
      warnings: [
        {
          ruleId: 'ab-write-eacces',
          risk: 'high',
          intervention: 'warn',
          confidence: 0.8,
          safeAction: 'check_permissions',
          reasons: ['tool', 'path_prefix'],
        },
        {
          ruleId: 'ab-retry',
          risk: 'medium',
          intervention: 'confirm',
          confidence: 0.5,
          safeAction: 'retry_with_backoff',
          reasons: ['error_code'],
        },
      ],
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.matchedRuleIds).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records an empty preflight without extra fields', () => {
    const parsed = JSON.parse(
      formatAntibodiesPreflightJson({
        blocked: false,
        elapsedMs: 0,
        semanticUsed: false,
        warnings: [],
      }),
    ) as AntibodiesPreflightJson;
    expect(parsed.warnings).toEqual([]);
    expect(parsed.blocked).toBe(false);
    expect(Object.keys(parsed).sort()).toEqual(['blocked', 'elapsedMs', 'semanticUsed', 'warnings']);
  });
});
