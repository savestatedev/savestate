import { describe, expect, it } from 'vitest';
import { formatAclListJsonSummary } from '../acl.js';
import type { Commitment } from '../../acl/index.js';

function commitment(id: string): Commitment {
  return {
    id,
    type: 'customer_promise',
    criticality: 'c3',
    state: 'proposed',
    description: `Commitment ${id}`,
    proposedAt: '2026-11-06T00:00:00.000Z',
    proposer: 'agent-1',
    auditTrail: [],
  };
}

describe('savestate acl list --json-summary', () => {
  it('reports page navigation while keeping entries machine-readable', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      [commitment('cmt-a'), commitment('cmt-b'), commitment('cmt-c')],
      1,
      1,
    ));

    expect(summary).toMatchObject({
      found: true,
      total: 3,
      shown: 1,
      remaining: 1,
      emptyReason: null,
      offset: 1,
      maxOffset: 1000,
      limit: 1,
      pageSize: 1,
      page: 2,
      totalPages: 3,
      hasPrevious: true,
      previousOffset: 0,
      hasMore: true,
      nextOffset: 2,
      suggestedOffset: null,
    });
    expect(summary.entries.map((entry: { id: string }) => entry.id)).toEqual(['cmt-b']);
  });

  it('identifies an exhausted page and suggests the last valid offset', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      [commitment('cmt-a'), commitment('cmt-b'), commitment('cmt-c')],
      10,
      2,
    ));

    expect(summary).toMatchObject({
      found: false,
      total: 3,
      shown: 0,
      remaining: 0,
      emptyReason: 'page',
      pageSize: 2,
      page: 6,
      totalPages: 2,
      hasPrevious: true,
      previousOffset: 2,
      hasMore: false,
      nextOffset: null,
      suggestedOffset: 2,
    });
    expect(summary.entries).toEqual([]);
  });

  it('does not advertise a continuation beyond the bounded offset', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      Array.from({ length: 1002 }, (_, index) => commitment(`cmt-${index}`)),
      1000,
      1,
    ));

    expect(summary).toMatchObject({
      offset: 1000,
      maxOffset: 1000,
      shown: 1,
      remaining: 1,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('reports only pages reachable within the offset ceiling', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      Array.from({ length: 1200 }, (_, index) => commitment(`cmt-${index}`)),
      1000,
      100,
    ));

    expect(summary).toMatchObject({
      offset: 1000,
      maxOffset: 1000,
      page: 11,
      totalPages: 11,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('caps stale-page recovery at the supported offset ceiling', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      Array.from({ length: 1200 }, (_, index) => commitment(`cmt-${index}`)),
      1500,
      100,
    ));

    expect(summary).toMatchObject({
      offset: 1500,
      maxOffset: 1000,
      emptyReason: 'page',
      suggestedOffset: 1000,
      previousOffset: 1000,
    });
  });
});
