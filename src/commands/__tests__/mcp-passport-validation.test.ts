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
  ])('rejects malformed passport data: %j', (value) => {
    expect(isValidMemoryPassport(value)).toBe(false);
  });
});
