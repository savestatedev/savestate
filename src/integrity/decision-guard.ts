/**
 * Decision Guard (Post-GA Pilot)
 * 
 * Pre-action memory reliability gate that validates memories
 * before costly/risky actions are executed.
 * 
 * Note: This is designed for post-GA pilot only.
 * Guard decisions use only Core APIs/artifacts.
 */

import {
  ActionEvaluationRequest,
  ActionEvaluationResult,
  IntegrityMetadata,
} from './types.js';
import { IntegrityValidator } from './validator.js';
import { IntegrityRetrieval } from './retrieval.js';

/**
 * Risk thresholds for action approval
 */
export interface RiskThresholds {
  /** Minimum confidence for low-risk actions */
  low: number;
  /** Minimum confidence for medium-risk actions */
  medium: number;
  /** Minimum confidence for high-risk actions */
  high: number;
  /** Minimum confidence for critical actions */
  critical: number;
}

const DEFAULT_THRESHOLDS: RiskThresholds = {
  low: 0.5,
  medium: 0.75,
  high: 0.90,
  critical: 0.95,
};

/**
 * Memory for evaluation
 */
export interface EvaluableMemory {
  memory_id: string;
  integrity?: IntegrityMetadata;
  created_at: string;
  importance?: number;
  task_criticality?: number;
}

/**
 * Idempotency cache entry
 */
interface CacheEntry {
  result: ActionEvaluationResult;
  expires_at: number;
}

/**
 * Decision Guard Service
 * 
 * Evaluates actions against memory integrity before execution.
 */
export class DecisionGuard {
  private idempotencyCache: Map<string, CacheEntry> = new Map();
  private retrieval: IntegrityRetrieval;
  private thresholds: RiskThresholds;

  constructor(
    private validator: IntegrityValidator,
    options?: { thresholds?: Partial<RiskThresholds>; cacheTtlMs?: number }
  ) {
    this.retrieval = new IntegrityRetrieval(validator);
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options?.thresholds };
    this.cacheTtlMs = options?.cacheTtlMs ?? 60000; // 1 minute default
  }

  private cacheTtlMs: number;

  /**
   * Evaluate an action for execution safety.
   * Returns cached result for duplicate idempotency keys.
   */
  async evaluateAction(
    request: ActionEvaluationRequest,
    memories: EvaluableMemory[]
  ): Promise<ActionEvaluationResult> {
    // Check idempotency cache
    const cached = this.getCached(request.idempotency_key);
    if (cached) {
      return cached;
    }

    // Evaluate the action
    const result = this.doEvaluate(request, memories);

    // Cache the result
    this.setCached(request.idempotency_key, result);

    return result;
  }

  /**
   * Perform the actual evaluation
   */
  private doEvaluate(
    request: ActionEvaluationRequest,
    memories: EvaluableMemory[]
  ): ActionEvaluationResult {
    const evaluated_at = new Date().toISOString();
    const policy_version = this.validator.getPolicy().version;

    // Get relevant memories
    const relevantMemories = memories.filter(m =>
      request.memory_refs.includes(m.memory_id)
    );

    // Prepare memories for execution check
    const prepared = this.retrieval.prepareForExecution(relevantMemories);

    // Identify failed memories
    const failedMemories = prepared
      .filter(p => !p.ready_for_execution)
      .map(p => ({
        memory_id: p.data.memory_id,
        reason: p.warnings.join('; ') || 'Failed integrity check',
      }));

    // Calculate confidence based on memory integrity
    const totalMemories = relevantMemories.length;
    const passedMemories = prepared.filter(p => p.ready_for_execution).length;
    const baseConfidence = totalMemories > 0 ? passedMemories / totalMemories : 0;

    // Adjust confidence based on memory importance/criticality
    const avgImportance =
      relevantMemories.reduce((sum, m) => sum + (m.importance ?? 0.5), 0) /
      Math.max(relevantMemories.length, 1);
    const avgCriticality =
      relevantMemories.reduce((sum, m) => sum + (m.task_criticality ?? 0.5), 0) /
      Math.max(relevantMemories.length, 1);

    // Weighted confidence
    const confidence = Math.min(
      1,
      baseConfidence * 0.6 + avgImportance * 0.2 + avgCriticality * 0.2
    );

    // Determine approval based on risk level and threshold
    const threshold = this.thresholds[request.action.risk_level];
    const approved = confidence >= threshold && failedMemories.length === 0;

    // Build reasons
    const reasons: string[] = [];
    if (approved) {
      reasons.push(
        `Confidence ${(confidence * 100).toFixed(1)}% meets threshold ${(threshold * 100).toFixed(0)}%`
      );
      reasons.push(`All ${totalMemories} relevant memories passed integrity checks`);
    } else {
      if (confidence < threshold) {
        reasons.push(
          `Confidence ${(confidence * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(0)}%`
        );
      }
      if (failedMemories.length > 0) {
        reasons.push(
          `${failedMemories.length} of ${totalMemories} memories failed integrity checks`
        );
      }
    }

    // Build recommendations
    const recommendations: string[] = [];
    if (!approved) {
      if (failedMemories.length > 0) {
        recommendations.push(
          'Revalidate or refresh failed memories before retrying'
        );
      }
      if (confidence < threshold) {
        recommendations.push(
          'Gather additional evidence or reduce action risk level'
        );
      }
      if (request.action.risk_level === 'critical') {
        recommendations.push('Consider human review for critical actions');
      }
    }

    return {
      approved,
      confidence,
      reasons,
      failed_memories: failedMemories,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      evaluated_at,
      policy_version,
    };
  }

  /**
   * Get cached result
   */
  private getCached(key: string): ActionEvaluationResult | null {
    const entry = this.idempotencyCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires_at) {
      this.idempotencyCache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Set cached result
   */
  private setCached(key: string, result: ActionEvaluationResult): void {
    this.idempotencyCache.set(key, {
      result,
      expires_at: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Clear the idempotency cache
   */
  clearCache(): void {
    this.idempotencyCache.clear();
  }

  /**
   * Get current thresholds
   */
  getThresholds(): RiskThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  setThresholds(thresholds: Partial<RiskThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Quick check if memories are ready for a risk level
   */
  quickCheck(
    memories: EvaluableMemory[],
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): { ready: boolean; confidence: number; threshold: number } {
    const readiness = this.retrieval.checkExecutionReadiness(memories);
    const threshold = this.thresholds[riskLevel];
    const confidence =
      memories.length > 0 ? readiness.summary.passed / memories.length : 0;

    return {
      ready: readiness.ready && confidence >= threshold,
      confidence,
      threshold,
    };
  }
}
