/**
 * Promotion Worker
 *
 * Issue #65: Staged Memory Promotion Engine (Trust Kernel)
 *
 * Evaluates candidate entries for promotion to stable state.
 */

import type {
  TrustEntry,
  PromotionRule,
  TransitionEvent,
} from './types.js';
import { TrustStore } from './store.js';

export interface PromotionWorkerOptions {
  /** Trust store instance */
  store: TrustStore;

  /** Promotion rules to evaluate */
  rules: PromotionRule[];

  /** Target p95 latency for evaluation start (ms) */
  targetEvalStartLatencyMs?: number;

  /** Actor name for transition events */
  actorName?: string;
}

export interface PromotionResult {
  /** Entry that was evaluated */
  entry: TrustEntry;

  /** Whether promotion was successful */
  promoted: boolean;

  /** Rule that triggered promotion (if any) */
  matchedRule?: PromotionRule;

  /** Transition event (if promoted) */
  event?: TransitionEvent;

  /** Reasons for rejection (if not promoted) */
  rejectionReasons?: string[];

  /** Evaluation latency (ms) */
  latencyMs: number;
}

export interface PromotionBatchResult {
  /** Total entries evaluated */
  total: number;

  /** Entries promoted */
  promoted: number;

  /** Entries rejected */
  rejected: number;

  /** Entries skipped (no matching rule) */
  skipped: number;

  /** Individual results */
  results: PromotionResult[];

  /** Total batch latency (ms) */
  latencyMs: number;
}

/**
 * PromotionWorker evaluates candidates for promotion.
 */
export class PromotionWorker {
  private store: TrustStore;
  private rules: PromotionRule[];
  private targetEvalStartLatencyMs: number;
  private actorName: string;

  constructor(options: PromotionWorkerOptions) {
    this.store = options.store;
    this.rules = options.rules.filter((r) => r.enabled);
    this.targetEvalStartLatencyMs = options.targetEvalStartLatencyMs ?? 5000;
    this.actorName = options.actorName ?? 'promotion-worker';
  }

  /**
   * Evaluate a single entry for promotion.
   */
  evaluateEntry(entry: TrustEntry): PromotionResult {
    const startTime = Date.now();
    const rejectionReasons: string[] = [];

    // Check if entry is in valid state for promotion
    if (entry.state !== 'candidate') {
      return {
        entry,
        promoted: false,
        rejectionReasons: [`Invalid state for promotion: ${entry.state}`],
        latencyMs: Date.now() - startTime,
      };
    }

    // Episodic scope entries are never promoted
    if (entry.scope === 'episodic') {
      return {
        entry,
        promoted: false,
        rejectionReasons: ['Episodic scope entries are never promoted'],
        latencyMs: Date.now() - startTime,
      };
    }

    // Find matching rules for this entry's scope
    const scopeRules = this.rules.filter((r) => r.scope === entry.scope);
    if (scopeRules.length === 0) {
      return {
        entry,
        promoted: false,
        rejectionReasons: [`No promotion rules for scope: ${entry.scope}`],
        latencyMs: Date.now() - startTime,
      };
    }

    // Evaluate each rule
    for (const rule of scopeRules) {
      const ruleResult = this.evaluateRule(entry, rule);

      if (ruleResult.passed) {
        // Promote the entry
        const transition = this.store.transition(
          entry.id,
          'stable',
          `Promoted by rule: ${rule.name}`,
          this.actorName
        );

        if (transition.success) {
          return {
            entry,
            promoted: true,
            matchedRule: rule,
            event: transition.event,
            latencyMs: Date.now() - startTime,
          };
        } else {
          rejectionReasons.push(`Transition failed: ${transition.error}`);
        }
      } else {
        rejectionReasons.push(...ruleResult.reasons);
      }
    }

    return {
      entry,
      promoted: false,
      rejectionReasons,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Evaluate a rule against an entry.
   */
  private evaluateRule(
    entry: TrustEntry,
    rule: PromotionRule
  ): { passed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check confidence threshold
    if (entry.confidence < rule.minConfidence) {
      reasons.push(
        `[${rule.name}] Confidence ${entry.confidence} < ${rule.minConfidence}`
      );
    }

    // Check minimum age
    const ageMs = Date.now() - new Date(entry.createdAt).getTime();
    const ageSeconds = ageMs / 1000;
    if (ageSeconds < rule.minAgeSeconds) {
      reasons.push(
        `[${rule.name}] Age ${ageSeconds.toFixed(0)}s < ${rule.minAgeSeconds}s`
      );
    }

    // Check required tags
    if (rule.requiredTags && rule.requiredTags.length > 0) {
      const entryTags = entry.tags ?? [];
      const missingTags = rule.requiredTags.filter((t) => !entryTags.includes(t));
      if (missingTags.length > 0) {
        reasons.push(`[${rule.name}] Missing required tags: ${missingTags.join(', ')}`);
      }
    }

    // Check forbidden tags
    if (rule.forbiddenTags && rule.forbiddenTags.length > 0) {
      const entryTags = entry.tags ?? [];
      const presentForbidden = rule.forbiddenTags.filter((t) => entryTags.includes(t));
      if (presentForbidden.length > 0) {
        reasons.push(`[${rule.name}] Has forbidden tags: ${presentForbidden.join(', ')}`);
      }
    }

    return {
      passed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Run promotion evaluation on all eligible candidates.
   */
  runBatch(minAgeSeconds: number = 60): PromotionBatchResult {
    const startTime = Date.now();
    const candidates = this.store.getCandidatesForPromotion(minAgeSeconds);

    const results: PromotionResult[] = [];
    let promoted = 0;
    let rejected = 0;
    let skipped = 0;

    for (const entry of candidates) {
      const result = this.evaluateEntry(entry);
      results.push(result);

      if (result.promoted) {
        promoted++;
      } else if (result.rejectionReasons && result.rejectionReasons.length > 0) {
        // Check if it was actually rejected vs just no matching rule
        const hasRuleFailure = result.rejectionReasons.some(
          (r) => !r.includes('No promotion rules')
        );
        if (hasRuleFailure) {
          rejected++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    const latencyMs = Date.now() - startTime;
    if (latencyMs > this.targetEvalStartLatencyMs) {
      console.warn(
        `PromotionWorker batch latency ${latencyMs}ms exceeds target ${this.targetEvalStartLatencyMs}ms`
      );
    }

    return {
      total: candidates.length,
      promoted,
      rejected,
      skipped,
      results,
      latencyMs,
    };
  }

  /**
   * Add a new promotion rule.
   */
  addRule(rule: PromotionRule): void {
    if (rule.enabled) {
      this.rules.push(rule);
    }
  }

  /**
   * Remove a promotion rule by ID.
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all active rules.
   */
  getRules(): PromotionRule[] {
    return [...this.rules];
  }
}

// ─── Default Promotion Rules ─────────────────────────────────

/**
 * Create default promotion rules.
 */
export function createDefaultRules(): PromotionRule[] {
  return [
    {
      id: 'semantic-high-confidence',
      name: 'High Confidence Semantic Facts',
      scope: 'semantic',
      minConfidence: 0.8,
      minAgeSeconds: 300, // 5 minutes
      enabled: true,
    },
    {
      id: 'semantic-verified',
      name: 'Verified Semantic Facts',
      scope: 'semantic',
      minConfidence: 0.6,
      minAgeSeconds: 3600, // 1 hour
      requiredTags: ['verified'],
      enabled: true,
    },
    {
      id: 'procedural-tested',
      name: 'Tested Procedural Knowledge',
      scope: 'procedural',
      minConfidence: 0.9,
      minAgeSeconds: 600, // 10 minutes
      requiredTags: ['tested'],
      enabled: true,
    },
    {
      id: 'procedural-high-confidence',
      name: 'High Confidence Procedural',
      scope: 'procedural',
      minConfidence: 0.95,
      minAgeSeconds: 1800, // 30 minutes
      enabled: true,
    },
  ];
}
