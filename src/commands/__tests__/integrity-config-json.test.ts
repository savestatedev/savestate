import { describe, expect, it } from 'vitest';
import { formatIntegrityConfigJson, type IntegrityConfigJson } from '../integrity.js';

const result: IntegrityConfigJson & { secret?: string; honeyfact?: unknown } = {
  enabled: true,
  honeyfactCount: 10,
  honeyfactTtlDays: 7,
  tripwireThreshold: 0.8,
  tripwireFuzzyEnabled: true,
  containmentPolicy: 'approve',
  containmentAutoEscalate: true,
  secret: 'ss_live_SECRET',
  honeyfact: { content: 'ss_live_SECRET' },
};

describe('savestate integrity config --json', () => {
  it('prints a config summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityConfigJson(result)) as IntegrityConfigJson & {
      secret?: unknown;
      apiKey?: string;
      honeyfact?: unknown;
      tripwire?: unknown;
      containment?: unknown;
    };
    expect(parsed).toEqual({
      enabled: true,
      honeyfactCount: 10,
      honeyfactTtlDays: 7,
      tripwireThreshold: 0.8,
      tripwireFuzzyEnabled: true,
      containmentPolicy: 'approve',
      containmentAutoEscalate: true,
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.honeyfact).toBeUndefined();
    expect(parsed.tripwire).toBeUndefined();
    expect(parsed.containment).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records disabled defaults without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityConfigJson({
        enabled: false,
        honeyfactCount: 0,
        honeyfactTtlDays: 14,
        tripwireThreshold: 0,
        tripwireFuzzyEnabled: false,
        containmentPolicy: 'observe',
        containmentAutoEscalate: false,
      }),
    ) as IntegrityConfigJson;
    expect(parsed.enabled).toBe(false);
    expect(parsed.honeyfactCount).toBe(0);
    expect(parsed.honeyfactTtlDays).toBe(14);
    expect(parsed.tripwireThreshold).toBe(0);
    expect(parsed.tripwireFuzzyEnabled).toBe(false);
    expect(parsed.containmentPolicy).toBe('observe');
    expect(parsed.containmentAutoEscalate).toBe(false);
    expect(Object.keys(parsed).sort()).toEqual([
      'containmentAutoEscalate',
      'containmentPolicy',
      'enabled',
      'honeyfactCount',
      'honeyfactTtlDays',
      'tripwireFuzzyEnabled',
      'tripwireThreshold',
    ]);
  });
});
