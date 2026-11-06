import { describe, expect, it } from 'vitest';
import type { Commitment } from '../../acl/index.js';
import { formatAclCommitmentText, formatAclProposeRows } from '../acl.js';

describe('savestate acl human-readable output', () => {
  it('shows the proposer alongside the commitment details', () => {
    const commitment: Commitment = {
      id: 'cmt-1',
      type: 'customer_promise',
      criticality: 'c3',
      state: 'active',
      description: 'Refund within 24h',
      proposedAt: '2026-11-06T00:00:00.000Z',
      proposer: 'agent-1',
      auditTrail: [],
    };

    expect(formatAclCommitmentText(commitment)).toBe(
      'ID: cmt-1\n'
      + '  Type: customer_promise (c3)\n'
      + '  State: active\n'
      + '  Proposer: agent-1\n'
      + '  Verifier: —\n'
      + '  Expires: Never\n'
      + '  Description: Refund within 24h\n',
    );
  });

  it('shows verifier and expiry when a commitment has been verified', () => {
    expect(formatAclCommitmentText({
      id: 'cmt-2',
      type: 'account_tool_write',
      criticality: 'c1',
      state: 'verified',
      description: 'Rotate the API key',
      proposedAt: '2026-11-06T00:00:00.000Z',
      proposer: 'agent-1',
      verifier: 'reviewer-1',
      expiresAt: '2026-11-07T00:00:00.000Z',
      auditTrail: [],
    })).toContain(
      '  Verifier: reviewer-1\n  Expires: 2026-11-07T00:00:00.000Z\n',
    );
  });

  it('includes the proposer in the successful propose response', () => {
    expect(formatAclProposeRows({
      id: 'cmt-1',
      type: 'customer_promise',
      criticality: 'c3',
      state: 'proposed',
      description: 'Refund within 24h',
      proposedAt: '2026-11-06T00:00:00.000Z',
      proposer: 'agent-1',
      auditTrail: [],
    })).toEqual([
      'Commitment proposed: cmt-1',
      'State: proposed',
      'Criticality: c3',
      'Proposer: agent-1',
      'Expires: Never',
    ]);
  });
});
