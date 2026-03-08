/**
 * Signal Fitness League - Policy Engine
 * Issue #71: Promotion/demotion engine with guardrails
 *
 * - Promote if fitness > threshold for N evaluations
 * - Demote if fitness < threshold for M evaluations
 * - Safety layer: "never auto-drop" class for compliance, security, user-critical facts
 */

import { randomUUID } from 'crypto';
import {
  FitnessScore,
  PolicyDecision,
  PolicyThresholds,
  PromotionStatus,
  CriticalityClass,
  DEFAULT_POLICY_THRESHOLDS,
} from './types.js';
import { MemoryRegistry, RegistryEntry } from './registry.js';

/**
 * Policy decision type
 */
export type DecisionType = 'promote' | 'demote' | 'archive' | 'maintain' | 'protect';

/**
 * Pending decision before execution
 */
export interface PendingDecision {
  memory_id: string;
  decision_type: DecisionType;
  new_status: PromotionStatus;
  reason: string;
  fitness_score: number;
  evaluation_count: number;
  consecutive_count: number;
  safety_blocked: boolean;
  safety_reason?: string;
}

/**
 * Policy execution result
 */
export interface PolicyExecutionResult {
  executed: PolicyDecision[];
  blocked: PendingDecision[];
  errors: Array<{ memory_id: string; error: string }>;
}

/**
 * Policy Engine - Handles promotion and demotion decisions
 */
export class PolicyEngine {
  private thresholds: PolicyThresholds;
  private registry: MemoryRegistry;
  private auditLog: PolicyDecision[] = [];

  constructor(
    registry: MemoryRegistry,
    thresholds: Partial<PolicyThresholds> = {}
  ) {
    this.registry = registry;
    this.thresholds = { ...DEFAULT_POLICY_THRESHOLDS, ...thresholds };
  }

  /**
   * Evaluate a single memory and determine appropriate action
   */
  evaluate(entry: RegistryEntry, fitnessScore: FitnessScore): PendingDecision {
    const { memory, status, consecutive_failures, consecutive_successes } = entry;
    
    // Check if memory is protected
    if (this.isProtected(memory.criticality)) {
      return {
        memory_id: memory.id,
        decision_type: 'maintain',
        new_status: status,
        reason: 'Memory is protected and cannot be auto-demoted',
        fitness_score: fitnessScore.fitness,
        evaluation_count: fitnessScore.evaluation_count,
        consecutive_count: 0,
        safety_blocked: true,
        safety_reason: `Criticality class '${memory.criticality}' is protected`,
      };
    }
    
    const { 
      promotion_threshold, 
      demotion_threshold,
      min_evaluations_promote,
      min_evaluations_demote,
      consecutive_failures_demote,
    } = this.thresholds;
    
    // Check for promotion
    if (
      fitnessScore.fitness >= promotion_threshold &&
      fitnessScore.evaluation_count >= min_evaluations_promote &&
      consecutive_successes >= min_evaluations_promote
    ) {
      return {
        memory_id: memory.id,
        decision_type: 'promote',
        new_status: 'promoted',
        reason: `Fitness ${fitnessScore.fitness.toFixed(3)} >= ${promotion_threshold} for ${consecutive_successes} consecutive evaluations`,
        fitness_score: fitnessScore.fitness,
        evaluation_count: fitnessScore.evaluation_count,
        consecutive_count: consecutive_successes,
        safety_blocked: false,
      };
    }
    
    // Check for demotion
    if (
      fitnessScore.fitness < demotion_threshold &&
      fitnessScore.evaluation_count >= min_evaluations_demote
    ) {
      // Need consecutive failures before demotion
      if (consecutive_failures >= consecutive_failures_demote) {
        return {
          memory_id: memory.id,
          decision_type: 'demote',
          new_status: 'demoted',
          reason: `Fitness ${fitnessScore.fitness.toFixed(3)} < ${demotion_threshold} for ${consecutive_failures} consecutive evaluations`,
          fitness_score: fitnessScore.fitness,
          evaluation_count: fitnessScore.evaluation_count,
          consecutive_count: consecutive_failures,
          safety_blocked: false,
        };
      }
    }
    
    // Check for archival (extended demotion)
    if (
      status === 'demoted' &&
      fitnessScore.fitness < demotion_threshold * 0.5 &&
      consecutive_failures >= consecutive_failures_demote * 2
    ) {
      return {
        memory_id: memory.id,
        decision_type: 'archive',
        new_status: 'archived',
        reason: `Consistently low fitness (${fitnessScore.fitness.toFixed(3)}) while demoted; archiving`,
        fitness_score: fitnessScore.fitness,
        evaluation_count: fitnessScore.evaluation_count,
        consecutive_count: consecutive_failures,
        safety_blocked: false,
      };
    }
    
    // Maintain current status
    return {
      memory_id: memory.id,
      decision_type: 'maintain',
      new_status: status,
      reason: 'Fitness score within acceptable range or insufficient evaluations',
      fitness_score: fitnessScore.fitness,
      evaluation_count: fitnessScore.evaluation_count,
      consecutive_count: Math.max(consecutive_failures, consecutive_successes),
      safety_blocked: false,
    };
  }

  /**
   * Evaluate all memories in registry
   */
  evaluateAll(fitnessScores: Map<string, FitnessScore>): PendingDecision[] {
    const decisions: PendingDecision[] = [];
    
    for (const [memoryId, score] of fitnessScores) {
      const entry = this.registry.get(memoryId);
      if (!entry) continue;
      
      const decision = this.evaluate(entry, score);
      decisions.push(decision);
    }
    
    return decisions;
  }

  /**
   * Execute a pending decision
   */
  execute(decision: PendingDecision): PolicyDecision | null {
    if (decision.safety_blocked) {
      return null;
    }
    
    if (decision.decision_type === 'maintain') {
      return null;
    }
    
    const entry = this.registry.get(decision.memory_id);
    if (!entry) {
      throw new Error(`Memory ${decision.memory_id} not found in registry`);
    }
    
    const previousStatus = entry.status;
    
    // Execute the status change
    this.registry.updateStatus(decision.memory_id, decision.new_status);
    
    // Create audit record
    const auditRecord: PolicyDecision = {
      id: randomUUID(),
      memory_id: decision.memory_id,
      decided_at: new Date().toISOString(),
      previous_status: previousStatus,
      new_status: decision.new_status,
      reason: decision.reason,
      fitness_score: decision.fitness_score,
      evaluation_count: decision.evaluation_count,
      threshold_used: decision.decision_type === 'promote' 
        ? this.thresholds.promotion_threshold 
        : this.thresholds.demotion_threshold,
      safety_override: false,
    };
    
    this.auditLog.push(auditRecord);
    
    return auditRecord;
  }

  /**
   * Execute all non-blocked decisions
   */
  executeAll(decisions: PendingDecision[]): PolicyExecutionResult {
    const executed: PolicyDecision[] = [];
    const blocked: PendingDecision[] = [];
    const errors: Array<{ memory_id: string; error: string }> = [];
    
    for (const decision of decisions) {
      if (decision.safety_blocked) {
        blocked.push(decision);
        continue;
      }
      
      try {
        const result = this.execute(decision);
        if (result) {
          executed.push(result);
        }
      } catch (error) {
        errors.push({
          memory_id: decision.memory_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return { executed, blocked, errors };
  }

  /**
   * Manual override: promote a memory
   */
  manualPromote(memoryId: string, reason: string): PolicyDecision {
    const entry = this.registry.get(memoryId);
    if (!entry) {
      throw new Error(`Memory ${memoryId} not found`);
    }
    
    const previousStatus = entry.status;
    this.registry.updateStatus(memoryId, 'promoted');
    
    const auditRecord: PolicyDecision = {
      id: randomUUID(),
      memory_id: memoryId,
      decided_at: new Date().toISOString(),
      previous_status: previousStatus,
      new_status: 'promoted',
      reason: `Manual promotion: ${reason}`,
      fitness_score: entry.fitness_score?.fitness ?? 0,
      evaluation_count: entry.fitness_score?.evaluation_count ?? 0,
      threshold_used: 0,
      safety_override: true,
      override_reason: reason,
    };
    
    this.auditLog.push(auditRecord);
    return auditRecord;
  }

  /**
   * Manual override: demote a memory
   */
  manualDemote(memoryId: string, reason: string): PolicyDecision {
    const entry = this.registry.get(memoryId);
    if (!entry) {
      throw new Error(`Memory ${memoryId} not found`);
    }
    
    // Check protection
    if (this.isProtected(entry.memory.criticality)) {
      throw new Error(`Cannot demote protected memory (criticality: ${entry.memory.criticality})`);
    }
    
    const previousStatus = entry.status;
    this.registry.updateStatus(memoryId, 'demoted');
    
    const auditRecord: PolicyDecision = {
      id: randomUUID(),
      memory_id: memoryId,
      decided_at: new Date().toISOString(),
      previous_status: previousStatus,
      new_status: 'demoted',
      reason: `Manual demotion: ${reason}`,
      fitness_score: entry.fitness_score?.fitness ?? 0,
      evaluation_count: entry.fitness_score?.evaluation_count ?? 0,
      threshold_used: 0,
      safety_override: true,
      override_reason: reason,
    };
    
    this.auditLog.push(auditRecord);
    return auditRecord;
  }

  /**
   * Manual override: protect a memory
   */
  manualProtect(memoryId: string, reason: string): PolicyDecision {
    const entry = this.registry.get(memoryId);
    if (!entry) {
      throw new Error(`Memory ${memoryId} not found`);
    }
    
    const previousStatus = entry.status;
    this.registry.protect(memoryId);
    
    const auditRecord: PolicyDecision = {
      id: randomUUID(),
      memory_id: memoryId,
      decided_at: new Date().toISOString(),
      previous_status: previousStatus,
      new_status: 'protected',
      reason: `Manual protection: ${reason}`,
      fitness_score: entry.fitness_score?.fitness ?? 0,
      evaluation_count: entry.fitness_score?.evaluation_count ?? 0,
      threshold_used: 0,
      safety_override: true,
      override_reason: reason,
    };
    
    this.auditLog.push(auditRecord);
    return auditRecord;
  }

  /**
   * Manual override: unprotect a memory
   */
  manualUnprotect(memoryId: string, reason: string): PolicyDecision {
    const entry = this.registry.get(memoryId);
    if (!entry) {
      throw new Error(`Memory ${memoryId} not found`);
    }
    
    const previousStatus = entry.status;
    this.registry.unprotect(memoryId);
    
    const auditRecord: PolicyDecision = {
      id: randomUUID(),
      memory_id: memoryId,
      decided_at: new Date().toISOString(),
      previous_status: previousStatus,
      new_status: 'active',
      reason: `Manual unprotection: ${reason}`,
      fitness_score: entry.fitness_score?.fitness ?? 0,
      evaluation_count: entry.fitness_score?.evaluation_count ?? 0,
      threshold_used: 0,
      safety_override: true,
      override_reason: reason,
    };
    
    this.auditLog.push(auditRecord);
    return auditRecord;
  }

  /**
   * Check if a criticality class is protected
   */
  isProtected(criticality: CriticalityClass): boolean {
    return criticality === 'protected' || criticality === 'compliance';
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): PolicyDecision[] {
    const sorted = [...this.auditLog].sort(
      (a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime()
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get audit log for a specific memory
   */
  getMemoryAuditLog(memoryId: string): PolicyDecision[] {
    return this.auditLog
      .filter(d => d.memory_id === memoryId)
      .sort((a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime());
  }

  /**
   * Get decisions by date range
   */
  getDecisionsByDateRange(start: Date, end: Date): PolicyDecision[] {
    return this.auditLog.filter(d => {
      const decidedAt = new Date(d.decided_at);
      return decidedAt >= start && decidedAt <= end;
    });
  }

  /**
   * Get summary statistics
   */
  getSummary(days: number = 7): {
    total_decisions: number;
    promotions: number;
    demotions: number;
    archives: number;
    protections: number;
    manual_overrides: number;
  } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const recent = this.auditLog.filter(d => new Date(d.decided_at) >= cutoff);
    
    return {
      total_decisions: recent.length,
      promotions: recent.filter(d => d.new_status === 'promoted').length,
      demotions: recent.filter(d => d.new_status === 'demoted').length,
      archives: recent.filter(d => d.new_status === 'archived').length,
      protections: recent.filter(d => d.new_status === 'protected').length,
      manual_overrides: recent.filter(d => d.safety_override).length,
    };
  }

  /**
   * Get thresholds
   */
  getThresholds(): PolicyThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  updateThresholds(updates: Partial<PolicyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
  }

  /**
   * Clear audit log (for testing)
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Export audit log to JSON
   */
  exportAuditLog(): string {
    return JSON.stringify(this.auditLog, null, 2);
  }

  /**
   * Import audit log from JSON
   */
  importAuditLog(json: string): void {
    const imported = JSON.parse(json) as PolicyDecision[];
    this.auditLog = [...this.auditLog, ...imported];
  }
}

/**
 * Dry run policy evaluation (no side effects)
 */
export function dryRunEvaluation(
  entries: RegistryEntry[],
  fitnessScores: Map<string, FitnessScore>,
  thresholds: PolicyThresholds = DEFAULT_POLICY_THRESHOLDS
): PendingDecision[] {
  const decisions: PendingDecision[] = [];
  
  // Create temporary registry and engine
  const tempRegistry = new MemoryRegistry();
  for (const entry of entries) {
    tempRegistry.import([entry]);
  }
  
  const engine = new PolicyEngine(tempRegistry, thresholds);
  
  for (const entry of entries) {
    const score = fitnessScores.get(entry.memory.id);
    if (!score) continue;
    
    const decision = engine.evaluate(entry, score);
    decisions.push(decision);
  }
  
  return decisions;
}
