import { describe, expect, it } from 'vitest';
import { isValidMemoryPassport } from '../mcp.js';

describe('MCP passport validation', () => {
  it('accepts the fields required by the importer', () => {
    expect(
      isValidMemoryPassport({
        version: '1.0.0',
        source_agent: { id: 'chatgpt' },
        memories: [],
        snapshots: [],
      }),
    ).toBe(true);
  });

  it.each([
    null,
    {},
    { version: '1.0.0', memories: [], snapshots: [] },
    { version: '1.0.0', source_agent: {}, memories: [], snapshots: [] },
    { version: '1.0.0', source_agent: { id: 'chatgpt' }, memories: null, snapshots: [] },
    { version: '1.0.0', source_agent: { id: 'chatgpt' }, memories: [{}], snapshots: [] },
    {
      version: '1.0.0',
      source_agent: { id: 'chatgpt' },
      memories: [{
        id: 'memory-1',
        content: 'A memory',
        content_type: 'text',
        tags: [],
        importance: -0.1,
        created_at: '2026-01-01T00:00:00.000Z',
        source: { type: 'user_input', identifier: 'chatgpt' },
      }],
      snapshots: [],
    },
    {
      version: '1.0.0',
      source_agent: { id: 'chatgpt' },
      memories: [{
        id: 'memory-1',
        content: 'A memory',
        content_type: 'text',
        tags: [],
        importance: 1.1,
        created_at: '2026-01-01T00:00:00.000Z',
        source: { type: 'user_input', identifier: 'chatgpt' },
      }],
      snapshots: [],
    },
  ])('rejects malformed passport data: %j', (value) => {
    expect(isValidMemoryPassport(value)).toBe(false);
  });
});
