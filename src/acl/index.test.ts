import { describe, it, expect } from 'vitest';
import { proposeCommitment, verifyCommitment, gateAction, listCommitments } from '../index.js';

describe('Active Commitment Layer', () => {
  beforeEach(() => {
    // Clear commitments before each test if we had a database
  });

  it('should propose a new commitment', () => {
    const commitment = proposeCommitment({
      type: 'customer_promise',
      criticality: 'c3',
      description: 'Fix billing issue for customer X',
      proposer: 'agent-1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(commitment.id).toBeDefined();
    expect(commitment.state).toBe('proposed');
    expect(commitment.type).toBe('customer_promise');
    expect(commitment.criticality).toBe('c3');
    expect(commitment.auditTrail).toHaveLength(1);
    expect(commitment.auditTrail[0].action).toBe('proposed');
  });

  it('should verify a commitment', () => {
    const commitment = proposeCommitment({
      type: 'ticket_status_change',
      criticality: 'c2',
      description: 'Escalate ticket #123 to support',
      proposer: 'agent-1',
    });

    const verified = verifyCommitment(commitment.id, 'human-supervisor', true);
    expect(verified).not.toBeNull();
    expect(verified?.state).toBe('verified');
    expect(verified?.verifiedAt).toBeDefined();
    expect(verified?.verifier).toBe('human-supervisor');
    expect(verified?.auditTrail).toHaveLength(2);
  });

  it('should reject a commitment', () => {
    const commitment = proposeCommitment({
      type: 'account_tool_write',
      criticality: 'c1',
      description: 'Update user permissions',
      proposer: 'agent-1',
    });

    const rejected = verifyCommitment(commitment.id, 'human-supervisor', false);
    expect(rejected).not.toBeNull();
    expect(rejected?.state).toBe('rejected');
    expect(rejected?.rejectedAt).toBeDefined();
  });

  it('should block critical actions without active commitments', () => {
    const result = gateAction('customer_promise');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No active commitment found');
  });

  it('should allow lower criticality actions by default', () => {
    // c1 actions might not require a commitment
    const result = gateAction('ticket_status_change');
    // In this simple implementation, we only gate c3 actions
    // But in the future we might gate others
    // For now, let's say c1/c2 are allowed unless there's a specific rule
    expect(result.allowed).toBe(true);
  });
});
