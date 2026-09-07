import { describe, expect, it } from 'vitest';
import { formatIntegrityClearJson, type IntegrityClearJson } from '../integrity.js';

const result: IntegrityClearJson & { secret?: string; honeyfacts?: unknown } = {
  cleared: 10,
  tenantId: 'default',
  secret: 'ss_live_SECRET',
  honeyfacts: [{ content: 'ss_live_SECRET' }],
};

describe('savestate integrity clear --json', () => {
  it('prints a clear summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityClearJson(result)) as IntegrityClearJson & {
      secret?: unknown;
      apiKey?: string;
      honeyfacts?: unknown;
      content?: unknown;
    };
    expect(parsed).toEqual({
      cleared: 10,
      tenantId: 'default',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.honeyfacts).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a zero-count clear without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityClearJson({
        cleared: 0,
        tenantId: 'acme',
      }),
    ) as IntegrityClearJson;
    expect(parsed.cleared).toBe(0);
    expect(parsed.tenantId).toBe('acme');
    expect(Object.keys(parsed).sort()).toEqual(['cleared', 'tenantId']);
  });
});
