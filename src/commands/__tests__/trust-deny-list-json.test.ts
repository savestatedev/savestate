import { describe, expect, it } from 'vitest';
import { formatTrustDenyListJson, type TrustDenyListJson } from '../trust.js';

const entries = [
  {
    id: 'deny-1',
    pattern: 'secret.env',
    reason: 'contains credentials',
    addedAt: '2026-09-06T12:00:00.000Z',
    addedBy: 'cli',
    epoch: 1,
  },
  {
    id: 'deny-2',
    pattern: 'ssn:*',
    reason: 'matched denylist',
    addedAt: '2026-09-06T12:05:00.000Z',
    addedBy: 'write-gate',
    epoch: 2,
    secret: 'ss_live_SECRET',
  },
];

describe('savestate trust deny list --json', () => {
  it('prints denylist entries as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTrustDenyListJson(entries)) as TrustDenyListJson & {
      entries: Array<TrustDenyListJson['entries'][number] & { secret?: unknown }>;
      apiKey?: string;
    };
    expect(parsed.entries).toEqual([
      {
        id: 'deny-1',
        pattern: 'secret.env',
        reason: 'contains credentials',
        addedAt: '2026-09-06T12:00:00.000Z',
        addedBy: 'cli',
        epoch: 1,
      },
      {
        id: 'deny-2',
        pattern: 'ssn:*',
        reason: 'matched denylist',
        addedAt: '2026-09-06T12:05:00.000Z',
        addedBy: 'write-gate',
        epoch: 2,
      },
    ]);
    expect(parsed.entries[1]?.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      total: 2,
      shown: 2,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('records pagination for an empty denylist', () => {
    const parsed = JSON.parse(formatTrustDenyListJson([])) as TrustDenyListJson;
    expect(parsed.entries).toEqual([]);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      total: 0,
      shown: 0,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('reports continuation metadata for paged JSON output', () => {
    const parsed = JSON.parse(
      formatTrustDenyListJson(entries, { offset: '0', limit: '1' }),
    ) as TrustDenyListJson;

    expect(parsed.entries.map((entry) => entry.id)).toEqual(['deny-1']);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: 1,
      total: 2,
      shown: 1,
      hasMore: true,
      nextOffset: 1,
    });
  });
});
