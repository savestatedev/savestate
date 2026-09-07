import { describe, expect, it } from 'vitest';
import { formatAntibodiesAddJson, type AntibodiesAddJson } from '../antibodies.js';

const result: AntibodiesAddJson & { secret?: string } = {
  id: 'ab-write-eacces',
  risk: 'high',
  safeAction: 'check_permissions',
  confidence: 0.8,
  secret: 'ss_live_SECRET',
};

describe('savestate antibodies add --json', () => {
  it('prints an add summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesAddJson(result)) as AntibodiesAddJson & {
      secret?: unknown;
      apiKey?: string;
    };
    expect(parsed).toEqual({
      id: 'ab-write-eacces',
      risk: 'high',
      safeAction: 'check_permissions',
      confidence: 0.8,
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records default risk and action without extra fields', () => {
    const parsed = JSON.parse(
      formatAntibodiesAddJson({
        id: 'ab-retry',
        risk: 'medium',
        safeAction: 'retry_with_backoff',
        confidence: 0.5,
      }),
    ) as AntibodiesAddJson;
    expect(parsed.id).toBe('ab-retry');
    expect(parsed.risk).toBe('medium');
    expect(parsed.safeAction).toBe('retry_with_backoff');
    expect(parsed.confidence).toBe(0.5);
    expect(Object.keys(parsed).sort()).toEqual(['confidence', 'id', 'risk', 'safeAction']);
  });
});
