import { describe, expect, it } from 'vitest';
import { formatIntegrityRotateJson, type IntegrityRotateJson } from '../integrity.js';

const result: IntegrityRotateJson & { secret?: string; created?: unknown } = {
  rotated: 3,
  valid: 10,
  createdCount: 3,
  retiredCount: 3,
  tenantId: 'default',
  ttlDays: 7,
  rotatedAt: '2026-09-07T12:00:00.000Z',
  secret: 'ss_live_SECRET',
  created: [{ content: 'ss_live_SECRET' }],
};

describe('savestate integrity rotate --json', () => {
  it('prints a rotation summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityRotateJson(result)) as IntegrityRotateJson & {
      secret?: unknown;
      apiKey?: string;
      created?: unknown;
      retired?: unknown;
      content?: unknown;
      honeyfacts?: unknown;
    };
    expect(parsed).toEqual({
      rotated: 3,
      valid: 10,
      createdCount: 3,
      retiredCount: 3,
      tenantId: 'default',
      ttlDays: 7,
      rotatedAt: '2026-09-07T12:00:00.000Z',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.created).toBeUndefined();
    expect(parsed.retired).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(parsed.honeyfacts).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a zero-rotation summary without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityRotateJson({
        rotated: 0,
        valid: 5,
        createdCount: 0,
        retiredCount: 0,
        tenantId: 'acme',
        ttlDays: 14,
        rotatedAt: '2026-09-07T00:00:00.000Z',
      }),
    ) as IntegrityRotateJson;
    expect(parsed.rotated).toBe(0);
    expect(parsed.valid).toBe(5);
    expect(parsed.createdCount).toBe(0);
    expect(parsed.retiredCount).toBe(0);
    expect(parsed.tenantId).toBe('acme');
    expect(parsed.ttlDays).toBe(14);
    expect(Object.keys(parsed).sort()).toEqual([
      'createdCount',
      'retiredCount',
      'rotated',
      'rotatedAt',
      'tenantId',
      'ttlDays',
      'valid',
    ]);
  });
});
