/**
 * ActiveCommitmentLayer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ActiveCommitmentLayer,
  CommitmentStatus,
  Criticality,
  ActionType,
  VerificationMethod,
} from '../index.js';

describe('ActiveCommitmentLayer', () => {
  let acl: ActiveCommitmentLayer;

  beforeEach(() => {
    acl = new ActiveCommitmentLayer();
  });

  describe('propose', () => {
    it('should create a new commitment', () => {
      const result = acl.propose({
        title: 'Fix login bug',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C2,
        owner: 'agent-1',
        payload: { fix: 'login' },
      });

      expect(result.commitment).toBeDefined();
      expect(result.commitment.id).toContain('commit_');
      expect(result.commitment.title).toBe('Fix login bug');
      expect(result.commitment.status).toBe(CommitmentStatus.PROPOSED);
    });

    it('should auto-verify C1 commitments', () => {
      const result = acl.propose({
        title: 'C1 task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C1,
        owner: 'agent-1',
        payload: {},
      });

      expect(result.commitment.status).toBe(CommitmentStatus.ACTIVE);
      expect(result.commitment.verified).toBe(true);
    });

    it('should track expiration', () => {
      const result = acl.propose({
        title: 'Task with expiration',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C2,
        owner: 'agent-1',
        payload: {},
        expiresInSeconds: 3600,
      });

      expect(result.commitment.expiresAt).toBeDefined();
      const expires = new Date(result.commitment.expiresAt!);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      expect(diff).toBeGreaterThan(3500 * 1000);
      expect(diff).toBeLessThan(3700 * 1000);
    });

    it('should detect conflicts', () => {
      // Create and verify first commitment
      const first = acl.propose({
        title: 'Update customer X',
        type: ActionType.ACCOUNT_WRITE,
        criticality: Criticality.C3,
        owner: 'agent-1',
        target: 'customer-x',
        payload: { field: 'status' },
      });
      
      // Verify to make it active
      acl.verify(first.commitment.id, 'admin');

      // Try to create conflicting commitment (same target)
      const result = acl.propose({
        title: 'Another update to customer X',
        type: ActionType.CUSTOMER_PROMISE,
        criticality: Criticality.C3,
        owner: 'agent-2',
        target: 'customer-x',
        payload: {},
      });

      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('verify', () => {
    it('should verify a proposed commitment', () => {
      const { commitment } = acl.propose({
        title: 'Task to verify',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C2,
        owner: 'agent-1',
        payload: {},
      });

      const verified = acl.verify(commitment.id, 'admin');

      expect(verified.verified).toBe(true);
      expect(verified.verifiedBy).toBe('admin');
      expect(verified.status).toBe(CommitmentStatus.ACTIVE);
    });

    it('should reject verifying already verified commitment', () => {
      const { commitment } = acl.propose({
        title: 'C1 task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C1,
        owner: 'agent-1',
        payload: {},
      });

      expect(() => acl.verify(commitment.id, 'admin')).toThrow('already verified');
    });
  });

  describe('gate', () => {
    it('should allow action with no conflicts', () => {
      const decision = acl.gate(ActionType.DATA_EXPORT, 'user-1', 'report-1');

      expect(decision.allowed).toBe(true);
      expect(decision.latencyMs).toBeLessThan(150); // p95 budget
    });

    it('should block action with target conflict', () => {
      // Create and verify active commitment
      const { commitment } = acl.propose({
        title: 'Update account',
        type: ActionType.ACCOUNT_WRITE,
        criticality: Criticality.C3,
        owner: 'agent-1',
        target: 'account-123',
        payload: { status: 'active' },
      });
      
      // Verify it to make it active
      acl.verify(commitment.id, 'admin');

      // Try conflicting action
      const decision = acl.gate(
        ActionType.CUSTOMER_PROMISE, 
        'agent-2', 
        'account-123'
      );

      expect(decision.allowed).toBe(false);
      expect(decision.commitmentId).toBeDefined();
      expect(decision.reason).toContain('Blocked by commitment');
    });

    it('should block unverified C3+ commitments', () => {
      // Create C3 commitment but DON'T verify it
      acl.propose({
        title: 'Critical update',
        type: ActionType.CUSTOMER_PROMISE,
        criticality: Criticality.C3,
        owner: 'agent-1',
        target: 'customer-1',
        payload: {},
      });

      // Don't verify it - C3 requires verification

      const decision = acl.gate(
        ActionType.CUSTOMER_PROMISE,
        'agent-2',
        'customer-1'
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('requires verification');
    });

    it('should return audit entry', () => {
      const decision = acl.gate(ActionType.STATE_MUTATION, 'actor-1');

      expect(decision.auditEntry).toBeDefined();
      expect(decision.auditEntry.actor).toBe('actor-1');
    });
  });

  describe('override', () => {
    it('should override a commitment', () => {
      const { commitment } = acl.propose({
        title: 'Task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C2,
        owner: 'agent-1',
        payload: {},
      });

      const overridden = acl.override({
        commitmentId: commitment.id,
        actor: 'admin',
        reason: 'Business need',
      });

      expect(overridden.status).toBe(CommitmentStatus.OVERRIDDEN);
      expect(overridden.overriddenBy).toBe('admin');
      expect(overridden.overrideReason).toBe('Business need');
    });

    it('should require reason when configured', () => {
      const aclWithReason = new ActiveCommitmentLayer({ overrideRequiresReason: true });
      
      const { commitment } = aclWithReason.propose({
        title: 'Task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C2,
        owner: 'agent-1',
        payload: {},
      });

      expect(() => 
        aclWithReason.override({
          commitmentId: commitment.id,
          actor: 'admin',
          reason: '',
        })
      ).toThrow('requires a reason');
    });
  });

  describe('list', () => {
    it('should list all commitments', () => {
      acl.propose({ title: 'Task 1', type: ActionType.STATE_MUTATION, criticality: Criticality.C1, owner: 'a', payload: {} });
      acl.propose({ title: 'Task 2', type: ActionType.STATE_MUTATION, criticality: Criticality.C1, owner: 'b', payload: {} });

      const list = acl.list();

      expect(list).toHaveLength(2);
    });

    it('should filter by status', () => {
      const { commitment } = acl.propose({ 
        title: 'Task', 
        type: ActionType.STATE_MUTATION, 
        criticality: Criticality.C1, 
        owner: 'a', 
        payload: {} 
      });

      const active = acl.list({ status: [CommitmentStatus.ACTIVE] });
      const proposed = acl.list({ status: [CommitmentStatus.PROPOSED] });

      expect(active.length).toBeGreaterThan(0);
      expect(proposed.length).toBe(0);
    });

    it('should filter by owner', () => {
      acl.propose({ title: 'Task 1', type: ActionType.STATE_MUTATION, criticality: Criticality.C1, owner: 'agent-a', payload: {} });
      acl.propose({ title: 'Task 2', type: ActionType.STATE_MUTATION, criticality: Criticality.C1, owner: 'agent-b', payload: {} });

      const list = acl.list({ owner: 'agent-a' });

      expect(list).toHaveLength(1);
      expect(list[0].owner).toBe('agent-a');
    });

    it('should filter by target', () => {
      acl.propose({ 
        title: 'Task 1', 
        type: ActionType.ACCOUNT_WRITE, 
        criticality: Criticality.C1, 
        owner: 'a', 
        target: 'account-1',
        payload: {} 
      });
      acl.propose({ 
        title: 'Task 2', 
        type: ActionType.ACCOUNT_WRITE, 
        criticality: Criticality.C1, 
        owner: 'b', 
        target: 'account-2',
        payload: {} 
      });

      const list = acl.list({ target: 'account-1' });

      expect(list).toHaveLength(1);
      expect(list[0].target).toBe('account-1');
    });
  });

  describe('complete & reject', () => {
    it('should complete a commitment', () => {
      const { commitment } = acl.propose({
        title: 'Task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C1,
        owner: 'agent-1',
        payload: {},
      });

      const completed = acl.complete(commitment.id, 'admin');

      expect(completed.status).toBe(CommitmentStatus.COMPLETED);
      expect(completed.completedAt).toBeDefined();
    });

    it('should reject a commitment', () => {
      const { commitment } = acl.propose({
        title: 'Task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C2,
        owner: 'agent-1',
        payload: {},
      });

      const rejected = acl.reject(commitment.id, 'admin', 'Not needed');

      expect(rejected.status).toBe(CommitmentStatus.REJECTED);
    });
  });

  describe('audit', () => {
    it('should track audit trail', () => {
      const { commitment } = acl.propose({
        title: 'Task',
        type: ActionType.STATE_MUTATION,
        criticality: Criticality.C1,
        owner: 'agent-1',
        payload: {},
      });

      const audit = acl.getAuditTrail(commitment.id);

      expect(audit.length).toBeGreaterThan(0);
      expect(audit.some(e => e.action === 'proposed')).toBe(true);
    });

    it('should get global audit trail', () => {
      acl.propose({ title: 'Task 1', type: ActionType.STATE_MUTATION, criticality: Criticality.C1, owner: 'a', payload: {} });
      acl.propose({ title: 'Task 2', type: ActionType.STATE_MUTATION, criticality: Criticality.C1, owner: 'b', payload: {} });

      const global = acl.getGlobalAuditTrail();

      expect(global.length).toBeGreaterThan(1);
    });
  });
});
