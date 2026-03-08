/**
 * Trust Gates
 *
 * Issue #65: Staged Memory Promotion Engine (Trust Kernel)
 *
 * Implements WriteGate, TrustGate, and ActionGate for trust enforcement.
 */

import { createHash } from 'node:crypto';
import type {
  TrustEntry,
  TrustState,
  TrustMode,
  PromotionScope,
  TrustDecision,
  WriteGateResult,
  TrustGateResult,
  ActionGateResult,
  SideEffectRegistration,
  EffectType,
} from './types.js';
import { TrustStore } from './store.js';

// ─── Write Gate ──────────────────────────────────────────────

export interface WriteGateOptions {
  /** Trust store instance */
  store: TrustStore;

  /** Target latency for p95 (ms) */
  targetLatencyMs?: number;

  /** Default scope for entries without explicit scope */
  defaultScope?: PromotionScope;

  /** Minimum confidence threshold to accept */
  minConfidence?: number;
}

/**
 * WriteGate evaluates incoming memory writes.
 * All writes start as 'candidate' state.
 */
export class WriteGate {
  private store: TrustStore;
  private targetLatencyMs: number;
  private defaultScope: PromotionScope;
  private minConfidence: number;

  constructor(options: WriteGateOptions) {
    this.store = options.store;
    this.targetLatencyMs = options.targetLatencyMs ?? 50;
    this.defaultScope = options.defaultScope ?? 'semantic';
    this.minConfidence = options.minConfidence ?? 0;
  }

  /**
   * Evaluate a memory write request.
   */
  evaluate(request: {
    content: string;
    source: string;
    scope?: PromotionScope;
    confidence?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): WriteGateResult {
    const startTime = Date.now();
    const blockers: string[] = [];

    // Check denylist
    const denyCheck = this.store.isDenylisted(request.content);
    if (denyCheck.denied) {
      return {
        allowed: false,
        assignedState: 'rejected',
        assignedScope: request.scope ?? this.defaultScope,
        confidence: 0,
        blockers: [`Denylisted: ${denyCheck.reason}`],
        latencyMs: Date.now() - startTime,
      };
    }

    // Validate confidence
    const confidence = request.confidence ?? 0.5;
    if (confidence < this.minConfidence) {
      blockers.push(`Confidence ${confidence} below threshold ${this.minConfidence}`);
    }

    // Determine scope
    const scope = request.scope ?? this.defaultScope;

    // All valid writes start as candidate
    const assignedState: TrustState = blockers.length > 0 ? 'rejected' : 'candidate';

    const latencyMs = Date.now() - startTime;
    if (latencyMs > this.targetLatencyMs) {
      console.warn(`WriteGate latency ${latencyMs}ms exceeds target ${this.targetLatencyMs}ms`);
    }

    return {
      allowed: blockers.length === 0,
      assignedState,
      assignedScope: scope,
      confidence,
      blockers,
      latencyMs,
    };
  }

  /**
   * Process a write through the gate and persist if allowed.
   */
  async process(request: {
    content: string;
    source: string;
    scope?: PromotionScope;
    confidence?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
    ttlSeconds?: number;
  }): Promise<{ entry?: TrustEntry; result: WriteGateResult }> {
    const result = this.evaluate(request);

    if (!result.allowed) {
      return { result };
    }

    const entry = this.store.create({
      content: request.content,
      scope: result.assignedScope,
      confidence: result.confidence,
      source: request.source,
      tags: request.tags,
      metadata: request.metadata,
      ttlSeconds: request.ttlSeconds,
    });

    return { entry, result };
  }
}

// ─── Trust Gate ──────────────────────────────────────────────

export interface TrustGateOptions {
  /** Trust store instance */
  store: TrustStore;

  /** Current trust mode */
  mode: TrustMode;

  /** Minimum confidence for trusted retrieval */
  minConfidenceForTrust?: number;
}

/**
 * TrustGate filters memories based on trust state.
 * Used before including memories in context.
 */
export class TrustGate {
  private store: TrustStore;
  private mode: TrustMode;
  private minConfidenceForTrust: number;

  constructor(options: TrustGateOptions) {
    this.store = options.store;
    this.mode = options.mode;
    this.minConfidenceForTrust = options.minConfidenceForTrust ?? 0.7;
  }

  /**
   * Evaluate entries for trust-based filtering.
   */
  evaluate(entries: TrustEntry[]): TrustGateResult {
    const startTime = Date.now();
    const trusted: TrustEntry[] = [];
    const filtered: TrustEntry[] = [];
    const blockers: string[] = [];

    for (const entry of entries) {
      const isTrusted = this.isEntryTrusted(entry);

      if (this.mode === 'shadow') {
        // Shadow mode: log but don't filter
        trusted.push(entry);
        if (!isTrusted) {
          console.debug(`[shadow] Would filter entry ${entry.id}: state=${entry.state}`);
        }
      } else if (this.mode === 'enforce_query' || this.mode === 'enforce_action') {
        // Enforce mode: actually filter
        if (isTrusted) {
          trusted.push(entry);
        } else {
          filtered.push(entry);
          blockers.push(`Entry ${entry.id} filtered: state=${entry.state}`);
        }
      }
    }

    const decision = this.createDecision(trusted.length > 0, blockers);
    const latencyMs = Date.now() - startTime;

    return {
      trustedEntries: trusted,
      filteredEntries: filtered,
      decision,
      latencyMs,
    };
  }

  private isEntryTrusted(entry: TrustEntry): boolean {
    // Stable entries are always trusted
    if (entry.state === 'stable') {
      return true;
    }

    // High-confidence candidates may be trusted in some modes
    if (entry.state === 'candidate' && entry.confidence >= this.minConfidenceForTrust) {
      return this.mode === 'shadow'; // Only in shadow mode
    }

    return false;
  }

  private createDecision(allowed: boolean, blockers: string[]): TrustDecision {
    return {
      allowTrustedAnswer: allowed,
      allowTrustedAction: false, // TrustGate only handles answers
      trustMode: this.mode,
      blockers,
      reasonCodes: blockers.map(() => 'TRUST_FILTER'),
      stateEnvelopeHash: this.computeEnvelopeHash(),
      envelopeCompatLevel: 1,
      denylistEpoch: this.store.getDenylistEpoch(),
      timestamp: new Date().toISOString(),
    };
  }

  private computeEnvelopeHash(): string {
    // Simple hash of current state for integrity tracking
    const metrics = this.store.getMetrics();
    const data = JSON.stringify(metrics.entriesByState);
    return createHash('sha256').update(data).digest('hex').slice(0, 16);
  }
}

// ─── Side Effect Registry ────────────────────────────────────

/**
 * Registry for side effects (tools, external calls).
 * Deny-by-default: unregistered effects are blocked.
 */
export class SideEffectRegistry {
  private registrations = new Map<string, SideEffectRegistration>();

  /**
   * Register a side effect.
   */
  register(registration: SideEffectRegistration): void {
    this.registrations.set(registration.toolName, registration);
  }

  /**
   * Get registration for a tool.
   */
  get(toolName: string): SideEffectRegistration | undefined {
    return this.registrations.get(toolName);
  }

  /**
   * Check if a tool is registered.
   */
  isRegistered(toolName: string): boolean {
    return this.registrations.has(toolName);
  }

  /**
   * Get all registrations.
   */
  getAll(): SideEffectRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get registrations by effect type.
   */
  getByEffectType(effectType: EffectType): SideEffectRegistration[] {
    return this.getAll().filter((r) => r.effectType === effectType);
  }
}

// ─── Action Gate ─────────────────────────────────────────────

export interface ActionGateOptions {
  /** Trust store instance */
  store: TrustStore;

  /** Side effect registry */
  registry: SideEffectRegistry;

  /** Current trust mode */
  mode: TrustMode;
}

/**
 * ActionGate evaluates actions before execution.
 * Deny-by-default: unregistered actions are blocked.
 */
export class ActionGate {
  private store: TrustStore;
  private registry: SideEffectRegistry;
  private mode: TrustMode;

  constructor(options: ActionGateOptions) {
    this.store = options.store;
    this.registry = options.registry;
    this.mode = options.mode;
  }

  /**
   * Evaluate an action request.
   */
  evaluate(request: {
    toolName: string;
    contextEntries?: TrustEntry[];
  }): ActionGateResult {
    const startTime = Date.now();
    const blockers: string[] = [];

    // Check if tool is registered (deny-by-default)
    const registration = this.registry.get(request.toolName);
    if (!registration) {
      blockers.push(`Tool '${request.toolName}' not registered (deny-by-default)`);

      // Shadow mode: log but allow
      if (this.mode === 'shadow') {
        console.debug(`[shadow] Would block unregistered tool '${request.toolName}'`);
        return {
          allowed: true,
          decision: this.createDecision(true, []),
          blockers: [],
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        allowed: false,
        decision: this.createDecision(false, blockers),
        blockers,
        latencyMs: Date.now() - startTime,
      };
    }

    // Check trust level requirements
    if (registration.requiredTrustLevel !== 'any' && request.contextEntries) {
      const hasRequiredTrust = this.checkTrustLevel(
        request.contextEntries,
        registration.requiredTrustLevel
      );

      if (!hasRequiredTrust) {
        blockers.push(
          `Insufficient trust level: requires ${registration.requiredTrustLevel}`
        );
      }
    }

    // Shadow mode: log but allow
    if (this.mode === 'shadow') {
      if (blockers.length > 0) {
        console.debug(
          `[shadow] Would block action '${request.toolName}': ${blockers.join(', ')}`
        );
      }

      return {
        allowed: true,
        registration,
        decision: this.createDecision(true, []),
        blockers: [],
        latencyMs: Date.now() - startTime,
      };
    }

    // Enforce action mode: actually block
    if (this.mode === 'enforce_action') {
      return {
        allowed: blockers.length === 0,
        registration,
        decision: this.createDecision(blockers.length === 0, blockers),
        blockers,
        latencyMs: Date.now() - startTime,
      };
    }

    // Enforce query mode: allow actions but log
    return {
      allowed: true,
      registration,
      decision: this.createDecision(true, []),
      blockers: [],
      latencyMs: Date.now() - startTime,
    };
  }

  private checkTrustLevel(
    entries: TrustEntry[],
    required: 'stable_facts' | 'high_confidence'
  ): boolean {
    if (entries.length === 0) return false;

    if (required === 'stable_facts') {
      return entries.some((e) => e.state === 'stable');
    }

    if (required === 'high_confidence') {
      return entries.some((e) => e.confidence >= 0.8);
    }

    return false;
  }

  private createDecision(allowed: boolean, blockers: string[]): TrustDecision {
    return {
      allowTrustedAnswer: true, // ActionGate doesn't control answers
      allowTrustedAction: allowed,
      trustMode: this.mode,
      blockers,
      reasonCodes: blockers.map(() => 'ACTION_GATE'),
      stateEnvelopeHash: this.computeEnvelopeHash(),
      envelopeCompatLevel: 1,
      denylistEpoch: this.store.getDenylistEpoch(),
      timestamp: new Date().toISOString(),
    };
  }

  private computeEnvelopeHash(): string {
    const metrics = this.store.getMetrics();
    const data = JSON.stringify(metrics.entriesByState);
    return createHash('sha256').update(data).digest('hex').slice(0, 16);
  }
}
