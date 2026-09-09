import { describe, expect, it } from 'vitest';
import {
  formatPruneMissingJson,
  type PruneMissingJson,
} from '../prune.js';

describe('savestate prune --json when missing', () => {
  it('prints a missing prune summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatPruneMissingJson()) as PruneMissingJson & {
      keep?: unknown;
      drop?: unknown;
      reasons?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      dryRun: true,
      keepCount: 0,
      dropCount: 0,
    });
    expect(parsed.keep).toBeUndefined();
    expect(parsed.drop).toBeUndefined();
    expect(parsed.reasons).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'dropCount',
      'dryRun',
      'found',
      'keepCount',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
