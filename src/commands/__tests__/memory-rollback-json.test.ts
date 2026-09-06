import { describe, expect, it } from 'vitest';
import {
  formatMemoryRollbackJson,
  type MemoryRollbackJson,
} from '../memory-lifecycle.js';

describe('savestate memory rollback --json', () => {
  it('prints rolled-back status as JSON without content', () => {
    const parsed = JSON.parse(
      formatMemoryRollbackJson('mem-123', 2, 4, 'cli-user'),
    ) as MemoryRollbackJson & {
      content?: unknown;
      previous_content?: unknown;
      note?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      rolledBack: true,
      toVersion: 2,
      version: 4,
      actorId: 'cli-user',
    });
    expect(parsed.content).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.note).toBeUndefined();
  });

  it('records a second memory id, versions, and actor', () => {
    const parsed = JSON.parse(
      formatMemoryRollbackJson('mem-456', 1, 3, 'admin-1'),
    ) as MemoryRollbackJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.rolledBack).toBe(true);
    expect(parsed.toVersion).toBe(1);
    expect(parsed.version).toBe(3);
    expect(parsed.actorId).toBe('admin-1');
  });
});
