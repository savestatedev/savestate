import { describe, expect, it } from 'vitest';
import { formatCloudListJson, type CloudListResult } from '../cloud.js';

const result: CloudListResult = {
  tier: 'pro',
  cloudStorageUsed: 1048576,
  cloudStorageLimit: 10737418240,
  snapshots: [
    {
      id: 'ss-2026-01-26',
      size: 2048,
      createdAt: '2026-01-26T00:00:00.000Z',
    },
  ],
};

describe('savestate cloud --json', () => {
  it('prints cloud list metadata as JSON', () => {
    const parsed = JSON.parse(formatCloudListJson(result)) as CloudListResult & { apiKey?: string };
    expect(parsed.tier).toBe('pro');
    expect(parsed.cloudStorageUsed).toBe(1048576);
    expect(parsed.cloudStorageLimit).toBe(10737418240);
    expect(parsed.snapshots).toEqual(result.snapshots);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records an empty cloud inventory', () => {
    const parsed = JSON.parse(
      formatCloudListJson({
        tier: 'team',
        cloudStorageUsed: 0,
        cloudStorageLimit: 0,
        snapshots: [],
      }),
    ) as CloudListResult;
    expect(parsed.tier).toBe('team');
    expect(parsed.cloudStorageUsed).toBe(0);
    expect(parsed.cloudStorageLimit).toBe(0);
    expect(parsed.snapshots).toEqual([]);
  });
});
