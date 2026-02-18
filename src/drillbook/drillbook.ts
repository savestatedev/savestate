/**
 * Action Recall Drillbook
 * 
 * Pre-action memory reliability gate that tests high-risk facts
 * before costly actions.
 */

import { randomUUID } from 'crypto';
import {
  DrillItem,
  DrillbookStorage,
  CreateDrillInput,
  TestProtocolConfig,
  TestSession,
  TestResult,
  ActionCostLevel,
  ReadinessThresholds,
  ReadinessResult,
  MissRepair,
  SamplingWeights,
  DEFAULT_PROTOCOL_CONFIG,
  DEFAULT_READINESS_THRESHOLDS,
  DEFAULT_SAMPLING_WEIGHTS,
} from './types.js';

/**
 * Calculate similarity between two strings (simple Jaccard)
 */
function stringSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().trim().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().trim().split(/\s+/));
  
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  
  if (union.size === 0) return 1; // Both empty = same
  return intersection.size / union.size;
}

/**
 * Check if answer is correct (fuzzy match)
 */
function isAnswerCorrect(answer: string, expected: string, threshold = 0.7): boolean {
  // Exact match
  if (answer.toLowerCase().trim() === expected.toLowerCase().trim()) {
    return true;
  }
  
  // Fuzzy match
  return stringSimilarity(answer, expected) >= threshold;
}

/**
 * Calculate age score (older items get higher score)
 */
function ageScore(created_at: string): number {
  const ageMs = Date.now() - new Date(created_at).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  // Cap at 1.0 after 7 days
  return Math.min(1, ageMs / (7 * oneDayMs));
}

/**
 * Calculate change risk score based on source type
 */
function changeRiskScore(source_pointer: string): number {
  // Higher risk for volatile sources
  if (source_pointer.includes('http://') || source_pointer.includes('https://')) {
    return 0.8; // Web URLs change frequently
  }
  if (source_pointer.includes('/tmp/') || source_pointer.includes('temp')) {
    return 0.9; // Temp files very volatile
  }
  if (source_pointer.includes('.env') || source_pointer.includes('config')) {
    return 0.7; // Config files can change
  }
  return 0.3; // Default low risk
}

/**
 * Drillbook Service
 * 
 * Manages drill items and test protocols.
 */
export class Drillbook {
  private protocolConfig: TestProtocolConfig;
  private readinessThresholds: ReadinessThresholds;

  constructor(
    private storage: DrillbookStorage,
    options?: {
      protocolConfig?: Partial<TestProtocolConfig>;
      readinessThresholds?: Partial<ReadinessThresholds>;
    }
  ) {
    this.protocolConfig = {
      ...DEFAULT_PROTOCOL_CONFIG,
      ...options?.protocolConfig,
    };
    this.readinessThresholds = {
      ...DEFAULT_READINESS_THRESHOLDS,
      ...options?.readinessThresholds,
    };
  }

  /**
   * Create a new drill item
   */
  async createItem(input: CreateDrillInput): Promise<DrillItem> {
    const item: DrillItem = {
      id: randomUUID(),
      question: input.question,
      expected_answer: input.expected_answer,
      source_pointer: input.source_pointer,
      importance: input.importance ?? 3,
      expiry: input.expiry,
      critical: input.critical ?? false,
      invalidate_on: input.invalidate_on,
      action_type: input.action_type,
      created_at: new Date().toISOString(),
      miss_count: 0,
      test_history: [],
      active: true,
      created_by: input.created_by,
      checkpoint_id: input.checkpoint_id,
      tags: input.tags,
    };

    await this.storage.saveItem(item);
    return item;
  }

  /**
   * Get an item by ID
   */
  async getItem(id: string): Promise<DrillItem | null> {
    return this.storage.getItem(id);
  }

  /**
   * Get all active items for an actor
   */
  async getActiveItems(actor_id: string): Promise<DrillItem[]> {
    return this.storage.getActiveItems(actor_id);
  }

  /**
   * Sample items for a test session
   */
  async sampleItems(actor_id: string): Promise<DrillItem[]> {
    const { sample_size, sampling_weights } = this.protocolConfig;
    
    // Get all active items
    const activeItems = await this.storage.getActiveItems(actor_id);
    
    // Always include critical items
    const criticalItems = await this.storage.getCriticalItems(actor_id);
    
    // Filter out expired items
    const now = Date.now();
    const validItems = activeItems.filter(item => {
      if (!item.expiry) return true;
      return new Date(item.expiry).getTime() > now;
    });

    // Score each item for sampling
    const scored = validItems.map(item => ({
      item,
      score: this.calculateSamplingScore(item, sampling_weights),
    }));

    // Sort by score (higher = more likely to sample)
    scored.sort((a, b) => b.score - a.score);

    // Select items: always include critical, then top scored
    const selected = new Map<string, DrillItem>();
    
    // Add critical items first
    for (const item of criticalItems) {
      if (item.active) {
        selected.set(item.id, item);
      }
    }

    // Add top scored items up to sample_size
    for (const { item } of scored) {
      if (selected.size >= sample_size) break;
      if (!selected.has(item.id)) {
        selected.set(item.id, item);
      }
    }

    return Array.from(selected.values());
  }

  /**
   * Calculate sampling score for an item
   */
  private calculateSamplingScore(item: DrillItem, weights: SamplingWeights): number {
    const importanceScore = item.importance / 5; // Normalize to 0-1
    const missScore = Math.min(1, item.miss_count / 3); // Cap at 3 misses
    const age = ageScore(item.created_at);
    const changeRisk = changeRiskScore(item.source_pointer);

    return (
      importanceScore * weights.importance +
      missScore * weights.miss_history +
      age * weights.age +
      changeRisk * weights.change_risk
    );
  }

  /**
   * Start a test session
   */
  async startTestSession(actor_id: string): Promise<TestSession> {
    const items = await this.sampleItems(actor_id);
    
    return {
      session_id: randomUUID(),
      items,
      results: new Map(),
      started_at: new Date().toISOString(),
    };
  }

  /**
   * Record an answer for a test session
   */
  async recordAnswer(
    session: TestSession,
    item_id: string,
    answer: string,
    response_time_ms: number
  ): Promise<TestResult> {
    const item = session.items.find(i => i.id === item_id);
    if (!item) {
      throw new Error(`Item ${item_id} not in session`);
    }

    const similarity = stringSimilarity(answer, item.expected_answer);
    const correct = isAnswerCorrect(answer, item.expected_answer);

    const result: TestResult = {
      timestamp: new Date().toISOString(),
      answer,
      correct,
      similarity,
      response_time_ms,
    };

    session.results.set(item_id, result);
    
    // Update item in storage
    await this.storage.recordTestResult(item_id, result);
    
    // Update miss count if wrong
    if (!correct) {
      const stored = await this.storage.getItem(item_id);
      if (stored) {
        stored.miss_count += 1;
        stored.test_history.push(result);
        stored.last_tested_at = result.timestamp;
        await this.storage.saveItem(stored);
      }
    }

    return result;
  }

  /**
   * Complete a test session and calculate readiness
   */
  async completeSession(session: TestSession): Promise<TestSession> {
    session.ended_at = new Date().toISOString();
    
    // Calculate readiness score
    const totalItems = session.items.length;
    if (totalItems === 0) {
      session.readiness_score = 1;
      session.missed_items = [];
      session.critical_failures = [];
      return session;
    }

    let passed = 0;
    const missed: string[] = [];
    const criticalFailed: string[] = [];

    for (const item of session.items) {
      const result = session.results.get(item.id);
      if (!result || !result.correct) {
        missed.push(item.id);
        if (item.critical) {
          criticalFailed.push(item.id);
        }
      } else {
        passed++;
      }
    }

    session.readiness_score = passed / totalItems;
    session.missed_items = missed;
    session.critical_failures = criticalFailed;

    return session;
  }

  /**
   * Check readiness for an action
   */
  async checkReadiness(
    actor_id: string,
    cost_level: ActionCostLevel
  ): Promise<ReadinessResult> {
    // Run a test session
    const session = await this.startTestSession(actor_id);
    
    // For automated checking, we need answers - in real usage,
    // this would be called after a test session is complete.
    // For now, we'll check based on available items and their history.
    const activeItems = await this.storage.getActiveItems(actor_id);
    const criticalItems = await this.storage.getCriticalItems(actor_id);

    // Calculate readiness based on recent test history
    let totalWeight = 0;
    let passedWeight = 0;
    const criticalFailures: string[] = [];

    for (const item of activeItems) {
      if (!item.active) continue;
      
      const weight = item.importance;
      totalWeight += weight;

      // Check recent test history
      const recentTests = item.test_history.slice(-3);
      const recentPassed = recentTests.filter(t => t.correct).length;
      const passRate = recentTests.length > 0 ? recentPassed / recentTests.length : 0.5;
      
      passedWeight += weight * passRate;

      // Check for critical failures
      if (item.critical && recentTests.length > 0) {
        const lastTest = recentTests[recentTests.length - 1];
        if (!lastTest.correct) {
          criticalFailures.push(item.id);
        }
      }
    }

    const score = totalWeight > 0 ? passedWeight / totalWeight : 1;
    const threshold = this.readinessThresholds[cost_level];

    const allowed = 
      score >= threshold.min_score &&
      (threshold.allow_critical_miss || criticalFailures.length === 0);

    const recommendations: string[] = [];
    if (!allowed) {
      if (score < threshold.min_score) {
        recommendations.push(
          `Readiness score ${(score * 100).toFixed(1)}% below threshold ${(threshold.min_score * 100).toFixed(0)}%`
        );
        recommendations.push('Review and refresh drill items before proceeding');
      }
      if (criticalFailures.length > 0 && !threshold.allow_critical_miss) {
        recommendations.push(
          `${criticalFailures.length} critical items have recent failures`
        );
        recommendations.push('Address critical items before high-risk actions');
      }
    }

    return {
      allowed,
      score,
      cost_level,
      threshold: threshold.min_score,
      items_tested: activeItems.length,
      items_passed: Math.round(activeItems.length * score),
      critical_failures: criticalFailures,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Handle a miss by retrieving source and repairing
   */
  async repairMiss(
    item_id: string,
    source_content: string,
    source_changed: boolean
  ): Promise<MissRepair> {
    const item = await this.storage.getItem(item_id);
    if (!item) {
      throw new Error(`Item ${item_id} not found`);
    }

    const repair: MissRepair = {
      original_item_id: item_id,
      source_content,
      source_changed,
      action: 'corrected',
      repaired_at: new Date().toISOString(),
    };

    if (source_changed) {
      // Source has changed - retire old item and create replacement
      await this.storage.retireItem(item_id, 'source_changed');
      
      // Create replacement with updated answer
      const replacement = await this.createItem({
        question: item.question,
        expected_answer: source_content, // New answer from source
        source_pointer: item.source_pointer,
        importance: item.importance,
        critical: item.critical,
        action_type: item.action_type,
        created_by: item.created_by,
        tags: item.tags,
      });

      // Link replacement
      await this.storage.retireItem(item_id, 'source_changed', replacement.id);

      repair.action = 'replaced';
      repair.replacement_item = replacement;
      repair.corrected_answer = source_content;
    } else {
      // Source unchanged - just record the correction
      repair.action = 'corrected';
      repair.corrected_answer = item.expected_answer;
    }

    return repair;
  }

  /**
   * Retire an item manually
   */
  async retireItem(item_id: string, reason: string): Promise<void> {
    await this.storage.retireItem(item_id, reason);
  }

  /**
   * Get items due for testing
   */
  async getItemsDueForTesting(actor_id: string, limit = 10): Promise<DrillItem[]> {
    return this.storage.getItemsDueForTesting(actor_id, limit);
  }

  /**
   * Update protocol configuration
   */
  setProtocolConfig(config: Partial<TestProtocolConfig>): void {
    this.protocolConfig = { ...this.protocolConfig, ...config };
  }

  /**
   * Update readiness thresholds
   */
  setReadinessThresholds(thresholds: Partial<ReadinessThresholds>): void {
    this.readinessThresholds = { ...this.readinessThresholds, ...thresholds };
  }
}
