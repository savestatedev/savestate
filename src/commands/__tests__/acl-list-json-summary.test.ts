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
      emptyReason: null,
      offset: 1,
      limit: 1,
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
      emptyReason: 'page',
      hasPrevious: true,
      previousOffset: 2,
      hasMore: false,
      nextOffset: null,
      suggestedOffset: 2,
    });
    expect(summary.entries).toEqual([]);
  });
});
