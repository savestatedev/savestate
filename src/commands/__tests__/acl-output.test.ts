import { describe, expect, it } from 'vitest';
import type { Commitment } from '../../acl/index.js';
import { formatAclCommitmentText } from '../acl.js';

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
      + '  Description: Refund within 24h\n',
    );
  });
});
