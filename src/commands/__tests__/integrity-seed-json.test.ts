import { describe, expect, it } from 'vitest';
import { formatIntegritySeedJson, type IntegritySeedJson } from '../integrity.js';

const result: IntegritySeedJson & { secret?: string } = {
  count: 10,
  tenantId: 'default',
  ttlDays: 7,
  seededAt: '2026-09-07T12:00:00.000Z',
  secret: 'ss_live_SECRET',
};

describe('savestate integrity seed --json', () => {
  it('prints a seed summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegritySeedJson(result)) as IntegritySeedJson & {
      secret?: unknown;
      apiKey?: string;
      honeyfacts?: unknown;
      content?: unknown;
    };
    expect(parsed).toEqual({
      count: 10,
      tenantId: 'default',
      ttlDays: 7,
      seededAt: '2026-09-07T12:00:00.000Z',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.honeyfacts).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a zero-count seed without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegritySeedJson({
        count: 0,
        tenantId: 'acme',
        ttlDays: 14,
        seededAt: '2026-09-07T00:00:00.000Z',
      }),
    ) as IntegritySeedJson;
    expect(parsed.count).toBe(0);
    expect(parsed.tenantId).toBe('acme');
    expect(parsed.ttlDays).toBe(14);
    expect(Object.keys(parsed).sort()).toEqual(['count', 'seededAt', 'tenantId', 'ttlDays']);
  });
});
