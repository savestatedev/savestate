import { describe, expect, it } from 'vitest';
import {
  formatMemoryEditJson,
  type MemoryEditJson,
} from '../memory-lifecycle.js';

describe('savestate memory edit --json', () => {
  it('prints edited version as JSON without previous content', () => {
    const parsed = JSON.parse(
      formatMemoryEditJson({
        memory_id: 'mem-123',
        version: 2,
        content: 'Updated preference',
        tags: ['prefs'],
        importance: 0.9,
      }),
    ) as MemoryEditJson & {
      previous_content?: unknown;
      previous_versions?: unknown;
      provenance?: unknown;
    };
    expect(parsed).toEqual({
      id: 'mem-123',
      version: 2,
      content: 'Updated preference',
      tags: ['prefs'],
      importance: 0.9,
    });
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.previous_versions).toBeUndefined();
    expect(parsed.provenance).toBeUndefined();
  });

  it('records a second memory id and empty tags', () => {
    const parsed = JSON.parse(
      formatMemoryEditJson({
        memory_id: 'mem-456',
        version: 3,
        content: 'Later correction',
        tags: [],
        importance: 0,
      }),
    ) as MemoryEditJson;
    expect(parsed.id).toBe('mem-456');
    expect(parsed.version).toBe(3);
    expect(parsed.tags).toEqual([]);
    expect(parsed.importance).toBe(0);
  });
});
