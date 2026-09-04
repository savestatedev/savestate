import { describe, expect, it } from 'vitest';
import type { Commitment } from '../../acl/index.js';
import {
  formatAclCommitmentJson,
  formatAclGateJson,
  formatAclListJson,
  type AclCommitmentJson,
  type AclGateResult,
} from '../acl.js';

const commitment: Commitment = {
  id: 'cmt-1',
  type: 'customer_promise',
  criticality: 'c3',
  state: 'proposed',
  description: 'Refund within 24h',
  proposedAt: '2026-09-04T12:00:00.000Z',
  proposer: 'agent-1',
  auditTrail: [{ timestamp: '2026-09-04T12:00:00.000Z', action: 'proposed', actor: 'agent-1' }],
};

describe('savestate acl --json', () => {
  it('prints commitments as JSON without the audit trail', () => {
    const parsed = JSON.parse(formatAclListJson([commitment])) as Array<AclCommitmentJson & { auditTrail?: unknown }>;
    expect(parsed).toEqual([
      {
        id: 'cmt-1',
        type: 'customer_promise',
        criticality: 'c3',
        state: 'proposed',
        description: 'Refund within 24h',
        proposer: 'agent-1',
        verifier: null,
        expiresAt: null,
      },
    ]);
    expect(parsed[0].auditTrail).toBeUndefined();
  });

  it('records a verified commitment and an empty list', () => {
    const parsed = JSON.parse(
      formatAclCommitmentJson({
        ...commitment,
        state: 'verified',
        verifier: 'reviewer-1',
        expiresAt: '2026-09-05T12:00:00.000Z',
      }),
    ) as AclCommitmentJson;
    expect(parsed.state).toBe('verified');
    expect(parsed.verifier).toBe('reviewer-1');
    expect(parsed.expiresAt).toBe('2026-09-05T12:00:00.000Z');
    expect(formatAclListJson([])).toBe('[]');
  });

  it('prints a blocked gate result as JSON', () => {
    const parsed = JSON.parse(
      formatAclGateJson({
        allowed: false,
        action: 'customer_promise',
        reason: 'No active commitment found for action type: customer_promise.',
      }),
    ) as AclGateResult;
    expect(parsed.allowed).toBe(false);
    expect(parsed.action).toBe('customer_promise');
    expect(parsed.reason).toContain('No active commitment');
  });
});
