import { describe, expect, it } from 'vitest';
import type { Commitment } from '../../acl/index.js';
import {
  filterAclCommitments,
  formatAclListEmpty,
  formatAclListHeading,
  formatAclListJsonSummary,
  parseAclState,
} from '../acl.js';

function commitment(id: string, state: Commitment['state']): Commitment {
  return {
    id,
    type: 'customer_promise',
    criticality: 'c3',
    state,
    description: id,
    proposedAt: '2026-11-06T00:00:00.000Z',
    proposer: 'agent-1',
    auditTrail: [],
  };
}

describe('savestate acl list --state', () => {
  it('accepts lifecycle states case-insensitively', () => {
    expect(parseAclState(' ACTIVE ')).toBe('active');
    expect(parseAclState(undefined)).toBeUndefined();
  });

  it('rejects unknown lifecycle states', () => {
    expect(() => parseAclState('pending')).toThrow(
      'Invalid --state value "pending". Expected one of: proposed, verified, active, fulfilled, rejected, expired.',
    );
  });

  it('filters before pagination is applied by the command', () => {
    const commitments = [commitment('cmt-proposed', 'proposed'), commitment('cmt-active', 'active')];
    expect(filterAclCommitments(commitments, 'active').map(({ id }) => id)).toEqual(['cmt-active']);
    expect(filterAclCommitments(commitments, undefined)).toEqual(commitments);
  });

  it('combines state and type filters before pagination', () => {
    const commitments = [
      commitment('cmt-active-promise', 'active'),
      { ...commitment('cmt-active-write', 'active'), type: 'account_tool_write' as const },
      commitment('cmt-proposed-promise', 'proposed'),
    ];
    expect(filterAclCommitments(commitments, 'active', 'customer_promise').map(({ id }) => id))
      .toEqual(['cmt-active-promise']);
  });

  it('reports the state filter in JSON pagination metadata', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      [commitment('cmt-active', 'active')],
      0,
      10,
      'active',
      'customer_promise',
    ));
    expect(summary.state).toBe('active');
    expect(summary.type).toBe('customer_promise');
    expect(summary.entries.map((entry: { id: string }) => entry.id)).toEqual(['cmt-active']);
  });

  it('includes the active state filter in human-readable page messages', () => {
    expect(formatAclListHeading(1, 0, 5, 'active')).toBe(
      'Found 1 commitment(s) (skipped 0, limit 5, state active):',
    );
    expect(formatAclListEmpty(10, 5, 5, 'active')).toContain('state active');
    expect(formatAclListHeading(1, 0, 5, 'active', 'customer_promise')).toContain('type customer_promise');
  });
});
