import { describe, expect, it } from 'vitest';
import { resolveCloudLimit } from '../cloud.js';

describe('resolveCloudLimit', () => {
  it('uses --page-size as the cloud limit alias', () => {
    expect(resolveCloudLimit({ pageSize: '25' })).toBe('25');
  });

  it('rejects ambiguous --limit and --page-size input', () => {
    expect(() => resolveCloudLimit({ limit: '10', pageSize: '25' })).toThrow(
      'Cannot use --limit with --page-size; choose one limit option.',
    );
  });
});
