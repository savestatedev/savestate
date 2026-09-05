import { describe, expect, it } from 'vitest';
import { formatInspectJson, type InspectJson } from '../inspect.js';

const labeled: InspectJson = {
  id: 'ss-newer',
  timestamp: '2026-01-26T09:30:00.000Z',
  platform: 'claude',
  adapter: 'claude-code',
  label: 'pre-update',
  tags: ['weekly'],
  sizeBytes: 4096,
  parent: 'ss-older',
  counts: {
    memories: 3,
    conversations: 2,
    knowledge: 1,
    tools: 4,
    skills: 1,
    stateEvents: 5,
  },
  hasIdentity: true,
  chainAncestors: 1,
};

const unlabeled: InspectJson = {
  id: 'ss-older',
  timestamp: '2026-01-25T09:30:00.000Z',
  platform: 'claude',
  adapter: 'claude-code',
  label: null,
  tags: [],
  sizeBytes: 2048,
  parent: null,
  counts: {
    memories: 0,
    conversations: 0,
    knowledge: 0,
    tools: 0,
    skills: 0,
    stateEvents: 0,
  },
  hasIdentity: false,
  chainAncestors: 0,
};

describe('savestate inspect --json', () => {
  it('prints snapshot summary as JSON with content counts', () => {
    const parsed = JSON.parse(formatInspectJson(labeled)) as InspectJson;
    expect(parsed.id).toBe('ss-newer');
    expect(parsed.label).toBe('pre-update');
    expect(parsed.tags).toEqual(['weekly']);
    expect(parsed.sizeBytes).toBe(4096);
    expect(parsed.parent).toBe('ss-older');
    expect(parsed.counts).toEqual({
      memories: 3,
      conversations: 2,
      knowledge: 1,
      tools: 4,
      skills: 1,
      stateEvents: 5,
    });
    expect(parsed.hasIdentity).toBe(true);
    expect(parsed.chainAncestors).toBe(1);
  });

  it('records missing label and parent as null and missing tags as []', () => {
    const parsed = JSON.parse(formatInspectJson(unlabeled)) as InspectJson;
    expect(parsed.id).toBe('ss-older');
    expect(parsed.label).toBeNull();
    expect(parsed.tags).toEqual([]);
    expect(parsed.parent).toBeNull();
    expect(parsed.hasIdentity).toBe(false);
    expect(parsed.chainAncestors).toBe(0);
  });
});
