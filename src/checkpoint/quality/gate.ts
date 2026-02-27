/**
 * Memory Quality Gate
 *
 * Implements precision/recall metrics and confidence thresholds
 * for memory retrieval quality evaluation.
 *
 * @see https://github.com/savestatedev/savestate/issues/113
 */

export interface QualityBenchmark {
  id: string;
  name: string;
  description: string;
  threshold: number;
}

export interface BenchmarkResult {
  benchmarkId: string;
  score: number;
  passed: boolean;
  details?: string;
  timestamp: string;
}

export interface MemoryQualityConfig {
  precisionThreshold: number;
  recallThreshold: number;
  approvalMode: 'auto' | 'manual' | 'hybrid';
  confidenceThreshold: number;
}

export interface RecallTestCase {
  query: string;
  expectedMemoryIds: string[];
  description?: string;
}

export interface PrecisionTestCase {
  query: string;
  retrievedMemoryIds: string[];
  relevantMemoryIds: string[];
  description?: string;
}

export interface ConstraintRetentionTestCase {
  constraintId: string;
  expectedBehavior: string;
  testInputs: string[];
}

export interface ApprovalRequest {
  id: string;
  memoryId: string;
  action: 'include' | 'exclude' | 'modify';
  reason: string;
  confidenceScore: number;
  createdAt: string;
}

export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  decidedBy: string;
  decidedAt: string;
  notes?: string;
}

export const DEFAULT_QUALITY_CONFIG: MemoryQualityConfig = {
  precisionThreshold: 0.8,
  recallThreshold: 0.7,
  approvalMode: 'auto',
  confidenceThreshold: 0.6,
};

/**
 * Memory Quality Gate
 *
 * Evaluates memory retrieval quality using precision/recall metrics.
 */
export class MemoryQualityGate {
  constructor(private config: MemoryQualityConfig = DEFAULT_QUALITY_CONFIG) {}

  /**
   * Calculate precision: relevant retrieved / total retrieved
   */
  calculatePrecision(retrieved: string[], relevant: string[]): number {
    if (retrieved.length === 0) return 0;
    const relevantSet = new Set(relevant);
    const truePositives = retrieved.filter((id) => relevantSet.has(id)).length;
    return truePositives / retrieved.length;
  }

  /**
   * Calculate recall: relevant retrieved / total relevant
   */
  calculateRecall(retrieved: string[], relevant: string[]): number {
    if (relevant.length === 0) return 1; // No relevant items to miss
    const retrievedSet = new Set(retrieved);
    const truePositives = relevant.filter((id) => retrievedSet.has(id)).length;
    return truePositives / relevant.length;
  }

  /**
   * Calculate F1 score (harmonic mean of precision and recall)
   */
  calculateF1(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  /**
   * Check if retrieval meets quality thresholds
   */
  meetsThreshold(retrieved: string[], relevant: string[]): boolean {
    const precision = this.calculatePrecision(retrieved, relevant);
    const recall = this.calculateRecall(retrieved, relevant);
    return (
      precision >= this.config.precisionThreshold &&
      recall >= this.config.recallThreshold
    );
  }

  /**
   * Run precision test case
   */
  runPrecisionTest(testCase: PrecisionTestCase): BenchmarkResult {
    const precision = this.calculatePrecision(
      testCase.retrievedMemoryIds,
      testCase.relevantMemoryIds,
    );
    return {
      benchmarkId: `precision-${Date.now()}`,
      score: precision,
      passed: precision >= this.config.precisionThreshold,
      details: testCase.description,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run recall test case
   */
  runRecallTest(
    testCase: RecallTestCase,
    retrievedMemoryIds: string[],
  ): BenchmarkResult {
    const recall = this.calculateRecall(
      retrievedMemoryIds,
      testCase.expectedMemoryIds,
    );
    return {
      benchmarkId: `recall-${Date.now()}`,
      score: recall,
      passed: recall >= this.config.recallThreshold,
      details: testCase.description,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if memory should require approval based on confidence
   */
  requiresApproval(confidenceScore: number): boolean {
    if (this.config.approvalMode === 'auto') return false;
    if (this.config.approvalMode === 'manual') return true;
    // Hybrid mode: require approval for low-confidence decisions
    return confidenceScore < this.config.confidenceThreshold;
  }
}
