import { describe, expect, it } from 'vitest';
import { formatTrustAuditJson, type TrustAuditJson } from '../trust.js';
import type { TransitionEvent } from '../../trust-kernel/types.js';

const events: TransitionEvent[] = [
  {
    id: 'evt-1',
    entryId: 'mem-1',
    fromState: 'candidate',
    toState: 'stable',
    reason: 'passed promotion rule',
    actor: 'cli',
    timestamp: '2026-09-06T12:00:00.000Z',
  },
  {
    id: 'evt-2',
    entryId: 'mem-2',
    fromState: 'candidate',
    toState: 'rejected',
    reason: 'matched denylist',
    actor: 'write-gate',
    timestamp: '2026-09-06T12:05:00.000Z',
    metadata: { secret: 'ss_live_SECRET', pattern: 'ssn:*' },
  },
];

describe('savestate trust audit --json', () => {
  it('prints audit events as JSON without metadata', () => {
    const parsed = JSON.parse(formatTrustAuditJson(events)) as TrustAuditJson & {
      events: Array<TrustAuditJson['events'][number] & { metadata?: unknown }>;
      apiKey?: string;
    };
    expect(parsed.events).toEqual([
      {
        id: 'evt-1',
        entryId: 'mem-1',
        fromState: 'candidate',
        toState: 'stable',
        reason: 'passed promotion rule',
        actor: 'cli',
        timestamp: '2026-09-06T12:00:00.000Z',
      },
      {
        id: 'evt-2',
        entryId: 'mem-2',
        fromState: 'candidate',
        toState: 'rejected',
        reason: 'matched denylist',
        actor: 'write-gate',
        timestamp: '2026-09-06T12:05:00.000Z',
      },
    ]);
    expect(parsed.events[1]?.metadata).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: 50,
      total: 2,
      shown: 2,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('records an empty audit log without extra fields', () => {
    const parsed = JSON.parse(formatTrustAuditJson([])) as TrustAuditJson;
    expect(parsed.events).toEqual([]);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: 50,
      total: 0,
      shown: 0,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('reports continuation metadata for paged JSON output', () => {
    const parsed = JSON.parse(
      formatTrustAuditJson(events, { offset: '1', limit: '1' }),
    ) as TrustAuditJson;

    expect(parsed.events.map((event) => event.id)).toEqual(['evt-2']);
    expect(parsed.pagination).toEqual({
      offset: 1,
      limit: 1,
      total: 2,
      shown: 1,
      hasMore: false,
      nextOffset: null,
    });
  });
});
