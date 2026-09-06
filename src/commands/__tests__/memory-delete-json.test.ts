import { describe, expect, it } from 'vitest';
import {
  formatMemoryDeleteJson,
  type MemoryDeleteJson,
} from '../memory-lifecycle.js';

describe('savestate memory delete --json', () => {
  it('prints deleted status as JSON without the audit note', () => {
    const parsed = JSON.parse(
      formatMemoryDeleteJson('mem-123', 'stale', 'cli-user'),
    ) as MemoryDeleteJson & {
      note?: unknown;
      provenance?: unknown;
      previous_content?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      deleted: true,
      reason: 'stale',
      actorId: 'cli-user',
    });
    expect(parsed.note).toBeUndefined();
    expect(parsed.provenance).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
  });

  it('records a second memory id, reason, and actor', () => {
    const parsed = JSON.parse(
      formatMemoryDeleteJson('mem-456', 'incorrect', 'admin-1'),
    ) as MemoryDeleteJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.deleted).toBe(true);
    expect(parsed.reason).toBe('incorrect');
    expect(parsed.actorId).toBe('admin-1');
  });
});
