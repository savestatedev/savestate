import { describe, expect, it } from 'vitest';
import {
  formatCloudListJson,
  formatCloudPushJson,
  formatCloudPullJson,
  formatCloudDeleteJson,
  type CloudListResult,
  type CloudPushResult,
  type CloudPullResult,
  type CloudDeleteResult,
} from '../cloud.js';

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
  total: 2,
  offset: 0,
  limit: 1,
};

describe('savestate cloud --json', () => {
  it('prints cloud list metadata as JSON', () => {
    const parsed = JSON.parse(formatCloudListJson(result)) as CloudListResult & { apiKey?: string };
    expect(parsed.found).toBe(true);
    expect(parsed.tier).toBe('pro');
    expect(parsed.cloudStorageUsed).toBe(1048576);
    expect(parsed.cloudStorageLimit).toBe(10737418240);
    expect(parsed.total).toBe(2);
    expect(parsed.shown).toBe(1);
    expect(parsed.remaining).toBe(1);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBe(1);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(1);
    expect(parsed.totalPages).toBe(2);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextOffset).toBe(1);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.emptyReason).toBeNull();
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
        total: 0,
        offset: 0,
        limit: 5,
      }),
    ) as CloudListResult & { found: boolean };
    expect(parsed.found).toBe(false);
    expect(parsed.tier).toBe('team');
    expect(parsed.cloudStorageUsed).toBe(0);
    expect(parsed.cloudStorageLimit).toBe(0);
    expect(parsed.total).toBe(0);
    expect(parsed.shown).toBe(0);
    expect(parsed.remaining).toBe(0);
    expect(parsed.emptyReason).toBe('collection');
    expect(parsed.snapshots).toEqual([]);
  });

  it('points scripts to the previous page when an offset is stale', () => {
    const parsed = JSON.parse(formatCloudListJson({
      ...result,
      snapshots: [],
      total: 3,
      offset: 8,
      limit: 2,
    })) as CloudListResult & { found: boolean; emptyReason: string; previousOffset: number };

    expect(parsed.found).toBe(false);
    expect(parsed.emptyReason).toBe('page');
    expect(parsed.previousOffset).toBe(2);
  });
});

const pushResult: CloudPushResult = {
  pushed: 1,
  failed: 1,
  all: false,
  snapshots: [
    { id: 'ss-2026-01-26', uploaded: true },
    { id: 'ss-2026-01-25', uploaded: false },
  ],
};

describe('savestate cloud push --json', () => {
  it('prints push summary as JSON', () => {
    const parsed = JSON.parse(formatCloudPushJson(pushResult)) as CloudPushResult & { apiKey?: string };
    expect(parsed.found).toBe(true);
    expect(parsed.pushed).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.all).toBe(false);
    expect(parsed.snapshots).toEqual(pushResult.snapshots);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records an empty push', () => {
    const parsed = JSON.parse(
      formatCloudPushJson({
        pushed: 0,
        failed: 0,
        all: true,
        snapshots: [],
      }),
    ) as CloudPushResult & { found: boolean };
    expect(parsed.found).toBe(false);
    expect(parsed.pushed).toBe(0);
    expect(parsed.failed).toBe(0);
    expect(parsed.all).toBe(true);
    expect(parsed.snapshots).toEqual([]);
  });
});

const pullResult: CloudPullResult = {
  pulled: 1,
  failed: 1,
  skipped: 1,
  all: false,
  snapshots: [
    { id: 'ss-2026-01-26', downloaded: true, skipped: false },
    { id: 'ss-2026-01-25', downloaded: false, skipped: true },
    { id: 'ss-2026-01-24', downloaded: false, skipped: false },
  ],
};

describe('savestate cloud pull --json', () => {
  it('prints pull summary as JSON', () => {
    const parsed = JSON.parse(formatCloudPullJson(pullResult)) as CloudPullResult & { apiKey?: string };
    expect(parsed.found).toBe(true);
    expect(parsed.pulled).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.skipped).toBe(1);
    expect(parsed.all).toBe(false);
    expect(parsed.snapshots).toEqual(pullResult.snapshots);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records an empty pull', () => {
    const parsed = JSON.parse(
      formatCloudPullJson({
        pulled: 0,
        failed: 0,
        skipped: 0,
        all: true,
        snapshots: [],
      }),
    ) as CloudPullResult & { found: boolean };
    expect(parsed.found).toBe(false);
    expect(parsed.pulled).toBe(0);
    expect(parsed.failed).toBe(0);
    expect(parsed.skipped).toBe(0);
    expect(parsed.all).toBe(true);
    expect(parsed.snapshots).toEqual([]);
  });
});

const deleteResult: CloudDeleteResult = {
  deleted: 1,
  failed: 1,
  all: false,
  snapshots: [
    { id: 'ss-2026-01-26', deleted: true },
    { id: 'ss-2026-01-25', deleted: false },
  ],
};

describe('savestate cloud delete --json', () => {
  it('prints delete summary as JSON', () => {
    const parsed = JSON.parse(formatCloudDeleteJson(deleteResult)) as CloudDeleteResult & { apiKey?: string };
    expect(parsed.found).toBe(true);
    expect(parsed.deleted).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.all).toBe(false);
    expect(parsed.snapshots).toEqual(deleteResult.snapshots);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records an empty delete', () => {
    const parsed = JSON.parse(
      formatCloudDeleteJson({
        deleted: 0,
        failed: 0,
        all: true,
        snapshots: [],
      }),
    ) as CloudDeleteResult & { found: boolean };
    expect(parsed.found).toBe(false);
    expect(parsed.deleted).toBe(0);
    expect(parsed.failed).toBe(0);
    expect(parsed.all).toBe(true);
    expect(parsed.snapshots).toEqual([]);
  });
});
