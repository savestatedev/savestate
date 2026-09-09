import { describe, expect, it } from 'vitest';
import {
  formatMigrateMissingJson,
  type MigrateMissingJson,
} from '../migrate.js';

describe('savestate migrate --json when missing', () => {
  it('prints a missing migrate summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMigrateMissingJson()) as MigrateMissingJson & {
      generatedAt?: unknown;
      summary?: unknown;
      items?: unknown;
      recommendations?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      source: null,
      target: null,
      feasibility: null,
    });
    expect(parsed.generatedAt).toBeUndefined();
    expect(parsed.summary).toBeUndefined();
    expect(parsed.items).toBeUndefined();
    expect(parsed.recommendations).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'feasibility',
      'found',
      'source',
      'target',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
