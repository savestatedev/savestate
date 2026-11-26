import { describe, expect, it } from 'vitest';
import { formatCloudListJson } from '../cloud.js';

const base = {
  tier: 'pro',
  cloudStorageUsed: 0,
  cloudStorageLimit: 100,
};

describe('savestate cloud list JSON guidance', () => {
  it('points JSON consumers to the next page', () => {
    const parsed = JSON.parse(formatCloudListJson({
      ...base,
      snapshots: [{ id: 'a', size: 1, createdAt: '2026-01-01' }],
      total: 2,
      offset: 0,
      limit: 1,
    }));

    expect(parsed.guidance).toEqual({ action: 'next', offset: 1 });
  });

  it('points stale pages to the nearest available page', () => {
    const parsed = JSON.parse(formatCloudListJson({
      ...base,
      snapshots: [],
      total: 5,
      offset: 10,
      limit: 2,
    }));

    expect(parsed.guidance).toEqual({ action: 'retry', offset: 4 });
  });
});
