import { describe, expect, it } from 'vitest';
import { formatAdaptersJson, type AdapterListEntry } from '../adapters.js';

const adapter: AdapterListEntry = {
  id: 'claude-code',
  name: 'Claude Code',
  platform: 'claude-code',
  version: '1.0.0',
  detected: true,
};

describe('savestate adapters --json', () => {
  it('prints adapter records as JSON', () => {
    const parsed = JSON.parse(formatAdaptersJson([adapter])) as AdapterListEntry[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe('claude-code');
    expect(parsed[0]?.name).toBe('Claude Code');
    expect(parsed[0]?.platform).toBe('claude-code');
    expect(parsed[0]?.version).toBe('1.0.0');
    expect(parsed[0]?.detected).toBe(true);
  });

  it('prints an empty array when there are no adapters', () => {
    expect(formatAdaptersJson([])).toBe('[]');
  });
});
