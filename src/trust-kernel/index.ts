/**
 * Trust Kernel - Staged Memory Promotion Engine
 * 
 * Deterministic trust kernel that gates memory promotion and action execution
 * with scoped trust policies and fail-closed safety defaults.
 */

import { randomUUID } from 'crypto';

/**
 * Trust states for memory
 */
export enum TrustState {
  CANDIDATE = 'candidate',     // Unverified, needs promotion
  STABLE = 'stable',           // Verified, trusted
  REJECTED = 'rejected',      // Failed verification
  QUARANTINED = 'quarantined', // Flagged for review
}

/**
 * Promotion scopes
 */
export enum PromotionScope {
  SEMANTIC = 'semantic',   // Facts, knowledge claims
  PROCEDURAL = 'procedural', // How-to knowledge, tool patterns
  EPISODIC = 'episodic',   // Evidence-only, TTL-bound (never promoted)
}

/**
 * Trust enforcement modes
 */
export enum TrustMode {
  SHADOW = 'shadow',              // Log decisions, don't block
  ENFORCE_QUERY = 'enforce_query', // Block untrusted from retrieval
  ENFORCE_ACTION = 'enforce_action', // Block untrusted actions
}

/**
 * Side effect types
 */
export enum EffectType {
  READ_PURE = 'read_pure',
  READ_RISKY = 'read_risky',
  EXTERNAL_CALL = 'external_call',
  STATE_MUTATION = 'state_mutation',
}

/**
 * Trust level required
 */
export enum TrustLevel {
  ANY = 'any',
  STABLE_FACTS = 'stable_facts',
  HIGH_CONFIDENCE = 'high_confidence',
}

/**
 * Audit level
 */
export enum AuditLevel {
  NONE = 'none',
  LOG = 'log',
  REVIEW = 'review',
}

/**
 * Side effect registration
 */
export interface SideEffectRegistration {
  effectType: EffectType;
  toolName: string;
  requiredTrustLevel: TrustLevel;
  requiresExplicitAuth: boolean;
  auditLevel: AuditLevel;
}

/**
 * Trust decision
 */
export interface TrustDecision {
  allowTrustedAnswer: boolean;
  allowTrustedAction: boolean;
  trustMode: TrustMode;
  blockers: string[];
  reasonCodes: string[];
  stateEnvelopeHash: string;
  envelopeCompatLevel: number;
  denylistEpoch: number;
}

/**
 * Memory trust metadata
 */
export interface MemoryTrustMetadata {
  memoryId: string;
  state: TrustState;
  scope: PromotionScope;
  promotedAt?: string;
  confidence: number;
  verifiedBy?: string;
  reason?: string;
}

/**
 * Transition event for audit
 */
export interface TransitionEvent {
  id: string;
  memoryId: string;
  fromState: TrustState;
  toState: TrustState;
  timestamp: string;
  trigger: string;
  actor: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Trust policy configuration
 */
export interface TrustPolicy {
  mode: TrustMode;
  requireExplicitPromotion: boolean;
  autoPromoteAfterSeconds?: number;
  maxCandidates: number;
  quarantineThreshold: number;
  shadowModeLogging: boolean;
}

/**
 * WriteGate result
 */
export interface WriteGateResult {
  allowed: boolean;
  latencyMs: number;
  state: TrustState;
  reason?: string;
}

/**
 * ActionGate result
 */
export interface ActionGateResult {
  allowed: boolean;
  blocked: boolean;
  restricted: boolean;
  reason: string;
  requiredTrustLevel?: TrustLevel;
  auditEntry?: TransitionEvent;
}

/**
 * Trust kernel configuration
 */
export interface TrustKernelConfig {
  policy: TrustPolicy;
  denylistEpoch: number;
  enableActionGate: boolean;
  enableTrustGate: boolean;
}

/**
 * TrustKernel - implements staged memory promotion and action gating
 */
export class TrustKernel {
  private memoryTrust: Map<string, MemoryTrustMetadata> = new Map();
  private transitionEvents: TransitionEvent[] = [];
  private sideEffectRegistry: Map<string, SideEffectRegistration> = new Map();
  private config: TrustKernelConfig;
  private envelopeHash: string;

  constructor(config: Partial<TrustKernelConfig> = {}) {
    this.config = {
      policy: {
        mode: config.policy?.mode ?? TrustMode.SHADOW,
        requireExplicitPromotion: config.policy?.requireExplicitPromotion ?? true,
        autoPromoteAfterSeconds: config.policy?.autoPromoteAfterSeconds,
        maxCandidates: config.policy?.maxCandidates ?? 1000,
        quarantineThreshold: config.policy?.quarantineThreshold ?? 0.5,
        shadowModeLogging: config.policy?.shadowModeLogging ?? true,
      },
      denylistEpoch: config.denylistEpoch ?? 1,
      enableActionGate: config.enableActionGate ?? true,
      enableTrustGate: config.enableTrustGate ?? true,
    };
    
    this.envelopeHash = this.computeEnvelopeHash();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `te_${randomUUID()}`;
  }

  /**
   * Compute state envelope hash
   */
  private computeEnvelopeHash(): string {
    // Simple hash based on memory states
    let hash = 'env_';
    const states = Array.from(this.memoryTrust.values())
      .map(m => `${m.memoryId}:${m.state}`)
      .sort()
      .join('|');
    return hash + Math.abs(this.hashCode(states)).toString(16);
  }

  /**
   * Simple hash function
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Log transition event
   */
  private logTransition(
    memoryId: string,
    fromState: TrustState,
    toState: TrustState,
    trigger: string,
    actor: string,
    reason?: string
  ): void {
    const event: TransitionEvent = {
      id: this.generateId(),
      memoryId,
      fromState,
      toState,
      timestamp: new Date().toISOString(),
      trigger,
      actor,
      reason,
    };
    this.transitionEvents.push(event);
    this.envelopeHash = this.computeEnvelopeHash();
  }

  /**
   * Register a side effect
   */
  registerSideEffect(registration: SideEffectRegistration): void {
    this.sideEffectRegistry.set(registration.toolName, registration);
  }

  /**
   * Get side effect registration
   */
  getSideEffect(toolName: string): SideEffectRegistration | undefined {
    return this.sideEffectRegistry.get(toolName);
  }

  // ============ WriteGate ============

  /**
   * WriteGate - check if memory write is allowed
   */
  writeGate(memoryId: string, actor: string, scope: PromotionScope = PromotionScope.SEMANTIC): WriteGateResult {
    const startTime = Date.now();
    
    // Check if memory already exists
    const existing = this.memoryTrust.get(memoryId);
    
    if (existing) {
      // Already promoted memories can be updated
      if (existing.state === TrustState.STABLE) {
        return {
          allowed: true,
          latencyMs: Date.now() - startTime,
          state: TrustState.STABLE,
          reason: 'Stable memory update allowed',
        };
      }
    }

    // Check max candidates
    const candidateCount = Array.from(this.memoryTrust.values())
      .filter(m => m.state === TrustState.CANDIDATE).length;
    
    if (candidateCount >= this.config.policy.maxCandidates) {
      return {
        allowed: false,
        latencyMs: Date.now() - startTime,
        state: TrustState.REJECTED,
        reason: `Max candidates (${this.config.policy.maxCandidates}) reached`,
      };
    }

    // EPISODIC scope never gets promoted
    if (scope === PromotionScope.EPISODIC) {
      const metadata: MemoryTrustMetadata = {
        memoryId,
        state: TrustState.CANDIDATE,
        scope,
        confidence: 0,
        reason: 'Episodic scope - never promoted',
      };
      this.memoryTrust.set(memoryId, metadata);
      this.logTransition(memoryId, TrustState.CANDIDATE, TrustState.CANDIDATE, 'write', actor, 'episodic scope');
      
      return {
        allowed: true,
        latencyMs: Date.now() - startTime,
        state: TrustState.CANDIDATE,
        reason: 'Episodic memory accepted (will not be promoted)',
      };
    }

    // Auto-promote if configured
    if (this.config.policy.autoPromoteAfterSeconds !== undefined) {
      const metadata: MemoryTrustMetadata = {
        memoryId,
        state: TrustState.STABLE,
        scope,
        promotedAt: new Date().toISOString(),
        confidence: 1.0,
        verifiedBy: 'auto_promotion',
        reason: 'Auto-promoted',
      };
      this.memoryTrust.set(memoryId, metadata);
      this.logTransition(memoryId, TrustState.CANDIDATE, TrustState.STABLE, 'write', actor, 'auto-promotion');
      
      return {
        allowed: true,
        latencyMs: Date.now() - startTime,
        state: TrustState.STABLE,
        reason: 'Auto-promoted to stable',
      };
    }

    // Default: accept as candidate
    const metadata: MemoryTrustMetadata = {
      memoryId,
      state: TrustState.CANDIDATE,
      scope,
      confidence: 0,
    };
    this.memoryTrust.set(memoryId, metadata);
    this.logTransition(memoryId, TrustState.CANDIDATE, TrustState.CANDIDATE, 'write', actor);
    
    return {
      allowed: true,
      latencyMs: Date.now() - startTime,
      state: TrustState.CANDIDATE,
    };
  }

  // ============ Promotion ============

  /**
   * Promote memory to stable
   */
  promote(memoryId: string, actor: string, confidence: number = 1.0, reason?: string): MemoryTrustMetadata {
    const existing = this.memoryTrust.get(memoryId);
    
    if (!existing) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    if (existing.state === TrustState.STABLE) {
      throw new Error(`Memory ${memoryId} already stable`);
    }

    if (existing.scope === PromotionScope.EPISODIC) {
      throw new Error(`Episodic memories cannot be promoted`);
    }

    // Check confidence threshold
    if (confidence < this.config.policy.quarantineThreshold) {
      existing.state = TrustState.QUARANTINED;
      existing.confidence = confidence;
      existing.verifiedBy = actor;
      this.logTransition(memoryId, existing.state, TrustState.QUARANTINED, 'promote', actor, reason);
    } else {
      const oldState = existing.state;
      existing.state = TrustState.STABLE;
      existing.promotedAt = new Date().toISOString();
      existing.confidence = confidence;
      existing.verifiedBy = actor;
      existing.reason = reason;
      this.logTransition(memoryId, oldState, TrustState.STABLE, 'promote', actor, reason);
    }

    return existing;
  }

  /**
   * Reject memory
   */
  reject(memoryId: string, actor: string, reason: string): MemoryTrustMetadata {
    const existing = this.memoryTrust.get(memoryId);
    
    if (!existing) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    const oldState = existing.state;
    existing.state = TrustState.REJECTED;
    existing.reason = reason;
    this.logTransition(memoryId, oldState, TrustState.REJECTED, 'reject', actor, reason);

    return existing;
  }

  /**
   * Quarantine memory
   */
  quarantine(memoryId: string, actor: string, reason?: string): MemoryTrustMetadata {
    const existing = this.memoryTrust.get(memoryId);
    
    if (!existing) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    const oldState = existing.state;
    existing.state = TrustState.QUARANTINED;
    existing.reason = reason;
    this.logTransition(memoryId, oldState, TrustState.QUARANTINED, 'quarantine', actor, reason);

    return existing;
  }

  // ============ TrustGate ============

  /**
   * TrustGate - check if memory retrieval is allowed
   */
  trustGate(memoryIds: string[]): { allowed: string[]; blocked: string[]; restricted: string[] } {
    const allowed: string[] = [];
    const blocked: string[] = [];
    const restricted: string[] = [];

    for (const id of memoryIds) {
      const metadata = this.memoryTrust.get(id);
      
      if (!metadata) {
        // Unknown memory - treat as candidate
        if (this.config.policy.mode === TrustMode.ENFORCE_QUERY) {
          blocked.push(id);
        } else {
          restricted.push(id);
        }
        continue;
      }

      switch (metadata.state) {
        case TrustState.STABLE:
          allowed.push(id);
          break;
        case TrustState.CANDIDATE:
        case TrustState.QUARANTINED:
          if (this.config.policy.mode === TrustMode.ENFORCE_QUERY) {
            blocked.push(id);
          } else {
            restricted.push(id);
          }
          break;
        case TrustState.REJECTED:
          blocked.push(id);
          break;
      }
    }

    return { allowed, blocked, restricted };
  }

  // ============ ActionGate ============

  /**
   * ActionGate - check if action is allowed
   */
  actionGate(toolName: string, actor: string): ActionGateResult {
    const startTime = Date.now();
    
    // Get side effect registration
    const registration = this.sideEffectRegistry.get(toolName);
    
    if (!registration) {
      // Unregistered tool - deny by default
      const event: TransitionEvent = {
        id: this.generateId(),
        memoryId: toolName,
        fromState: TrustState.CANDIDATE,
        toState: TrustState.REJECTED,
        timestamp: new Date().toISOString(),
        trigger: 'action_gate',
        actor,
        reason: 'unregistered_tool',
      };
      
      return {
        allowed: false,
        blocked: true,
        restricted: false,
        reason: `Tool ${toolName} not registered - denied by default`,
        auditEntry: event,
      };
    }

    // Check required trust level
    if (registration.requiredTrustLevel !== TrustLevel.ANY) {
      // For now, check if we have stable memories
      const stableCount = Array.from(this.memoryTrust.values())
        .filter(m => m.state === TrustState.STABLE).length;
      
      if (stableCount === 0) {
        const event: TransitionEvent = {
          id: this.generateId(),
          memoryId: toolName,
          fromState: TrustState.CANDIDATE,
          toState: TrustState.REJECTED,
          timestamp: new Date().toISOString(),
          trigger: 'action_gate',
          actor,
          reason: 'insufficient_trust',
        };
        
        return {
          allowed: false,
          blocked: true,
          restricted: false,
          reason: `Requires ${registration.requiredTrustLevel} trust level but no stable memories`,
          requiredTrustLevel: registration.requiredTrustLevel,
          auditEntry: event,
        };
      }
    }

    // Check explicit auth requirement
    if (registration.requiresExplicitAuth) {
      const event: TransitionEvent = {
        id: this.generateId(),
        memoryId: toolName,
        fromState: TrustState.CANDIDATE,
        toState: TrustState.STABLE,
        timestamp: new Date().toISOString(),
        trigger: 'action_gate',
        actor,
        reason: 'explicit_auth_required',
      };
      
      return {
        allowed: true,
        blocked: false,
        restricted: true,
        reason: `Action requires explicit authorization`,
        requiredTrustLevel: registration.requiredTrustLevel,
        auditEntry: event,
      };
    }

    // Log audit if needed
    if (registration.auditLevel === AuditLevel.LOG || registration.auditLevel === AuditLevel.REVIEW) {
      const event: TransitionEvent = {
        id: this.generateId(),
        memoryId: toolName,
        fromState: TrustState.CANDIDATE,
        toState: TrustState.STABLE,
        timestamp: new Date().toISOString(),
        trigger: 'action_gate',
        actor,
        reason: `audit_${registration.auditLevel}`,
      };
      
      return {
        allowed: true,
        blocked: false,
        restricted: false,
        reason: 'Action allowed',
        auditEntry: event,
      };
    }

    return {
      allowed: true,
      blocked: false,
      restricted: false,
      reason: 'Action allowed',
    };
  }

  // ============ Query API ============

  /**
   * Get trust metadata for memory
   */
  getMemoryTrust(memoryId: string): MemoryTrustMetadata | undefined {
    return this.memoryTrust.get(memoryId);
  }

  /**
   * List memories by state
   */
  listByState(state: TrustState): MemoryTrustMetadata[] {
    return Array.from(this.memoryTrust.values())
      .filter(m => m.state === state);
  }

  /**
   * Get transition events for memory
   */
  getTransitionHistory(memoryId: string): TransitionEvent[] {
    return this.transitionEvents.filter(e => e.memoryId === memoryId);
  }

  /**
   * Get all transition events
   */
  getAllTransitions(limit: number = 100): TransitionEvent[] {
    return this.transitionEvents.slice(-limit);
  }

  /**
   * Get trust decision for current state
   */
  getTrustDecision(): TrustDecision {
    const stableCount = Array.from(this.memoryTrust.values())
      .filter(m => m.state === TrustState.STABLE).length;
    const candidateCount = Array.from(this.memoryTrust.values())
      .filter(m => m.state === TrustState.CANDIDATE).length;
    const quarantinedCount = Array.from(this.memoryTrust.values())
      .filter(m => m.state === TrustState.QUARANTINED).length;

    return {
      allowTrustedAnswer: stableCount > 0,
      allowTrustedAction: stableCount > 0,
      trustMode: this.config.policy.mode,
      blockers: quarantinedCount > 0 ? ['quarantined_memories'] : [],
      reasonCodes: ['trust_kernel_v1'],
      stateEnvelopeHash: this.envelopeHash,
      envelopeCompatLevel: 1,
      denylistEpoch: this.config.denylistEpoch,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): TrustKernelConfig {
    return { ...this.config };
  }

  /**
   * Update policy
   */
  updatePolicy(policy: Partial<TrustPolicy>): void {
    this.config.policy = { ...this.config.policy, ...policy };
  }

  /**
   * Set trust mode
   */
  setTrustMode(mode: TrustMode): void {
    this.config.policy.mode = mode;
  }

  /**
   * Get trust mode
   */
  getTrustMode(): TrustMode {
    return this.config.policy.mode;
  }
}

export default TrustKernel;
