/**
 * TrustKernel Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TrustKernel,
  TrustState,
  TrustMode,
  PromotionScope,
  EffectType,
  TrustLevel,
  AuditLevel,
} from '../index.js';

describe('TrustKernel', () => {
  let kernel: TrustKernel;

  beforeEach(() => {
    kernel = new TrustKernel();
  });

  describe('WriteGate', () => {
    it('should accept memory as candidate by default', () => {
      const result = kernel.writeGate('mem-1', 'agent');
      
      expect(result.allowed).toBe(true);
      expect(result.state).toBe(TrustState.CANDIDATE);
      expect(result.latencyMs).toBeLessThan(50); // p95 target
    });

    it('should auto-promote if configured', () => {
      const kernelWithAuto = new TrustKernel({
        policy: { autoPromoteAfterSeconds: 3600 },
      });
      
      const result = kernelWithAuto.writeGate('mem-1', 'agent');
      
      expect(result.state).toBe(TrustState.STABLE);
    });

    it('should reject episodic scope promotion', () => {
      const result = kernel.writeGate('mem-1', 'agent', PromotionScope.EPISODIC);
      
      expect(result.allowed).toBe(true);
      expect(result.state).toBe(TrustState.CANDIDATE);
      expect(result.reason).toContain('will not be promoted');
    });

    it('should track latency', () => {
      const result = kernel.writeGate('mem-1', 'agent');
      
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Promotion', () => {
    it('should promote candidate to stable', () => {
      kernel.writeGate('mem-1', 'agent');
      
      const result = kernel.promote('mem-1', 'admin', 0.9);
      
      expect(result.state).toBe(TrustState.STABLE);
      expect(result.confidence).toBe(0.9);
      expect(result.promotedAt).toBeDefined();
    });

    it('should quarantine low confidence', () => {
      kernel.writeGate('mem-1', 'agent');
      
      const result = kernel.promote('mem-1', 'admin', 0.3);
      
      expect(result.state).toBe(TrustState.QUARANTINED);
    });

    it('should reject memory', () => {
      kernel.writeGate('mem-1', 'agent');
      
      const result = kernel.reject('mem-1', 'admin', 'Failed verification');
      
      expect(result.state).toBe(TrustState.REJECTED);
      expect(result.reason).toBe('Failed verification');
    });

    it('should quarantine memory', () => {
      kernel.writeGate('mem-1', 'agent');
      
      const result = kernel.quarantine('mem-1', 'admin', 'Suspicious content');
      
      expect(result.state).toBe(TrustState.QUARANTINED);
    });

    it('should not promote already stable', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.promote('mem-1', 'admin');
      
      expect(() => kernel.promote('mem-1', 'admin')).toThrow('already stable');
    });

    it('should not promote episodic', () => {
      kernel.writeGate('mem-1', 'agent', PromotionScope.EPISODIC);
      
      expect(() => kernel.promote('mem-1', 'admin')).toThrow('cannot be promoted');
    });
  });

  describe('TrustGate', () => {
    it('should allow stable memories in enforce_query mode', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.promote('mem-1', 'admin');
      
      const result = kernel.trustGate(['mem-1']);
      
      expect(result.allowed).toContain('mem-1');
      expect(result.blocked).not.toContain('mem-1');
    });

    it('should block candidates in enforce_query mode', () => {
      kernel.setTrustMode(TrustMode.ENFORCE_QUERY);
      kernel.writeGate('mem-1', 'agent');
      
      const result = kernel.trustGate(['mem-1']);
      
      expect(result.blocked).toContain('mem-1');
    });

    it('should restrict candidates in shadow mode', () => {
      kernel.setTrustMode(TrustMode.SHADOW);
      kernel.writeGate('mem-1', 'agent');
      
      const result = kernel.trustGate(['mem-1']);
      
      expect(result.restricted).toContain('mem-1');
    });

    it('should block rejected memories', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.reject('mem-1', 'admin', 'Failed');
      
      const result = kernel.trustGate(['mem-1']);
      
      expect(result.blocked).toContain('mem-1');
    });
  });

  describe('ActionGate', () => {
    it('should deny unregistered tools by default', () => {
      const result = kernel.actionGate('unknown-tool', 'agent');
      
      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('not registered');
    });

    it('should allow registered read_pure tools', () => {
      kernel.registerSideEffect({
        toolName: 'read-data',
        effectType: EffectType.READ_PURE,
        requiredTrustLevel: TrustLevel.ANY,
        requiresExplicitAuth: false,
        auditLevel: AuditLevel.NONE,
      });
      
      const result = kernel.actionGate('read-data', 'agent');
      
      expect(result.allowed).toBe(true);
    });

    it('should require trust for high confidence actions', () => {
      kernel.registerSideEffect({
        toolName: 'write-db',
        effectType: EffectType.STATE_MUTATION,
        requiredTrustLevel: TrustLevel.STABLE_FACTS,
        requiresExplicitAuth: false,
        auditLevel: AuditLevel.NONE,
      });
      
      // No stable memories
      const result = kernel.actionGate('write-db', 'agent');
      
      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('should allow when stable memories exist', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.promote('mem-1', 'admin');
      
      kernel.registerSideEffect({
        toolName: 'write-db',
        effectType: EffectType.STATE_MUTATION,
        requiredTrustLevel: TrustLevel.STABLE_FACTS,
        requiresExplicitAuth: false,
        auditLevel: AuditLevel.NONE,
      });
      
      const result = kernel.actionGate('write-db', 'agent');
      
      expect(result.allowed).toBe(true);
    });

    it('should require explicit auth when configured', () => {
      kernel.registerSideEffect({
        toolName: 'sensitive-write',
        effectType: EffectType.EXTERNAL_CALL,
        requiredTrustLevel: TrustLevel.ANY,
        requiresExplicitAuth: true,
        auditLevel: AuditLevel.NONE,
      });
      
      const result = kernel.actionGate('sensitive-write', 'agent');
      
      expect(result.allowed).toBe(true);
      expect(result.restricted).toBe(true);
    });

    it('should include audit entry when required', () => {
      kernel.registerSideEffect({
        toolName: 'logged-action',
        effectType: EffectType.EXTERNAL_CALL,
        requiredTrustLevel: TrustLevel.ANY,
        requiresExplicitAuth: false,
        auditLevel: AuditLevel.LOG,
      });
      
      const result = kernel.actionGate('logged-action', 'agent');
      
      expect(result.auditEntry).toBeDefined();
      expect(result.auditEntry?.trigger).toBe('action_gate');
    });
  });

  describe('Query API', () => {
    it('should get memory trust metadata', () => {
      kernel.writeGate('mem-1', 'agent');
      
      const metadata = kernel.getMemoryTrust('mem-1');
      
      expect(metadata).toBeDefined();
      expect(metadata?.memoryId).toBe('mem-1');
      expect(metadata?.state).toBe(TrustState.CANDIDATE);
    });

    it('should list memories by state', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.writeGate('mem-2', 'agent');
      kernel.promote('mem-1', 'admin');
      
      const stable = kernel.listByState(TrustState.STABLE);
      const candidates = kernel.listByState(TrustState.CANDIDATE);
      
      expect(stable).toHaveLength(1);
      expect(candidates).toHaveLength(1);
    });

    it('should track transition history', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.promote('mem-1', 'admin');
      
      const history = kernel.getTransitionHistory('mem-1');
      
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('TrustDecision', () => {
    it('should return correct decision with stable memories', () => {
      kernel.writeGate('mem-1', 'agent');
      kernel.promote('mem-1', 'admin');
      
      const decision = kernel.getTrustDecision();
      
      expect(decision.allowTrustedAnswer).toBe(true);
      expect(decision.allowTrustedAction).toBe(true);
      expect(decision.denylistEpoch).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should update policy', () => {
      kernel.updatePolicy({ mode: TrustMode.ENFORCE_ACTION });
      
      expect(kernel.getTrustMode()).toBe(TrustMode.ENFORCE_ACTION);
    });

    it('should set trust mode', () => {
      kernel.setTrustMode(TrustMode.ENFORCE_QUERY);
      
      expect(kernel.getTrustMode()).toBe(TrustMode.ENFORCE_QUERY);
    });
  });
});