import { describe, expect, it } from 'vitest';
import {
  formatMemoryExpireJson,
  type MemoryExpireJson,
} from '../memory-lifecycle.js';

describe('savestate memory expire --json', () => {
  it('prints expired IDs as JSON without content', () => {
    const parsed = JSON.parse(
      formatMemoryExpireJson('org:app:agent', ['mem-123', 'mem-456']),
    ) as MemoryExpireJson & {
      content?: unknown;
      previous_content?: unknown;
      note?: unknown;
    };
    expect(parsed).toEqual({
      dryRun: false,
      applied: true,
      namespace: 'org:app:agent',
      expiredCount: 2,
      expiredIds: ['mem-123', 'mem-456'],
    });
    expect(parsed.content).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.note).toBeUndefined();
  });

  it('records a dry run without applying', () => {
    const parsed = JSON.parse(
      formatMemoryExpireJson('org:app:agent:user', ['mem-789'], { dryRun: true }),
    ) as MemoryExpireJson;
    expect(parsed.dryRun).toBe(true);
    expect(parsed.applied).toBe(false);
    expect(parsed.namespace).toBe('org:app:agent:user');
    expect(parsed.expiredCount).toBe(1);
    expect(parsed.expiredIds).toEqual(['mem-789']);
  });

  it('records no expirations as an empty list', () => {
    const parsed = JSON.parse(
      formatMemoryExpireJson('org:app:agent', []),
    ) as MemoryExpireJson;
    expect(parsed).toEqual({
      dryRun: false,
      applied: false,
      namespace: 'org:app:agent',
      expiredCount: 0,
      expiredIds: [],
    });
  });
});
