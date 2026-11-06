import { describe, expect, it } from 'vitest';
import type { Commitment } from '../../acl/index.js';
import {
  filterAclCommitments,
  formatAclListEmpty,
  formatAclListHeading,
  formatAclListJsonSummary,
  parseAclCriticality,
  parseAclState,
} from '../acl.js';

function commitment(
  id: string,
  state: Commitment['state'],
  criticality: Commitment['criticality'] = 'c3',
  proposer = 'agent-1',
  verifier?: string,
): Commitment {
  return {
    id,
    type: 'customer_promise',
    criticality,
    state,
    description: id,
    proposedAt: '2026-11-06T00:00:00.000Z',
    proposer,
    verifier,
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

  it('combines criticality with existing filters before pagination', () => {
    const commitments = [
      commitment('cmt-c1', 'active', 'c1'),
      commitment('cmt-c3', 'active', 'c3'),
      commitment('cmt-c1-proposed', 'proposed', 'c1'),
    ];
    expect(filterAclCommitments(commitments, 'active', 'customer_promise', 'c1').map(({ id }) => id))
      .toEqual(['cmt-c1']);
    expect(parseAclCriticality(' C2 ')).toBe('c2');
  });

  it('filters by proposer before pagination', () => {
    const commitments = [
      commitment('cmt-agent-1', 'active', 'c3', 'agent-1'),
      commitment('cmt-agent-2', 'active', 'c3', 'agent-2'),
    ];
    expect(filterAclCommitments(commitments, undefined, undefined, undefined, 'agent-2')
      .map(({ id }) => id)).toEqual(['cmt-agent-2']);
  });

  it('filters by verifier before pagination', () => {
    const commitments = [
      commitment('cmt-reviewer-1', 'active', 'c3', 'agent-1', 'reviewer-1'),
      commitment('cmt-reviewer-2', 'active', 'c3', 'agent-1', 'reviewer-2'),
      commitment('cmt-unverified', 'proposed'),
    ];
    expect(filterAclCommitments(commitments, undefined, undefined, undefined, undefined, 'reviewer-2')
      .map(({ id }) => id)).toEqual(['cmt-reviewer-2']);
  });

  it('reports the state filter in JSON pagination metadata', () => {
    const summary = JSON.parse(formatAclListJsonSummary(
      [commitment('cmt-active', 'active')],
      0,
      10,
      'active',
      'customer_promise',
      'c2',
      'agent-2',
      'reviewer-2',
    ));
    expect(summary.state).toBe('active');
    expect(summary.type).toBe('customer_promise');
    expect(summary.criticality).toBe('c2');
    expect(summary.proposer).toBe('agent-2');
    expect(summary.verifier).toBe('reviewer-2');
    expect(summary.entries.map((entry: { id: string }) => entry.id)).toEqual(['cmt-active']);
  });

  it('includes the active state filter in human-readable page messages', () => {
    expect(formatAclListHeading(1, 0, 5, 'active')).toBe(
      'Found 1 commitment(s) (skipped 0, limit 5, state active):',
    );
    expect(formatAclListEmpty(10, 5, 5, 'active')).toContain('state active');
    expect(formatAclListHeading(1, 0, 5, 'active', 'customer_promise')).toContain('type customer_promise');
    expect(formatAclListHeading(1, 0, 5, undefined, undefined, 'c1')).toContain('criticality c1');
    expect(formatAclListHeading(1, 0, 5, undefined, undefined, undefined, 'agent-2')).toContain('proposer agent-2');
    expect(formatAclListHeading(1, 0, 5, undefined, undefined, undefined, undefined, 'reviewer-2')).toContain('verifier reviewer-2');
  });
});
