import { describe, expect, it } from 'vitest';
import {
  formatMemoryRollbackMissingJson,
  type MemoryRollbackMissingJson,
} from '../memory-lifecycle.js';

describe('savestate memory rollback --json when missing', () => {
  it('prints a missing memory rollback summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatMemoryRollbackMissingJson('mem-missing')) as MemoryRollbackMissingJson & {
      toVersion?: unknown;
      version?: unknown;
      actorId?: unknown;
      content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'mem-missing',
      rolledBack: null,
    });
    expect(parsed.toVersion).toBeUndefined();
    expect(parsed.version).toBeUndefined();
    expect(parsed.actorId).toBeUndefined();
    expect(parsed.content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'id', 'rolledBack']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
