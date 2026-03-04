/**
 * Memory Quality Evaluation Framework
 *
 * Provides metrics and benchmarking for memory retrieval quality.
 * Helps detect regressions and validate memory system changes.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';

// ─── Types ───────────────────────────────────────────────────

/**
 * Quality metrics for memory retrieval evaluation.
 */
export interface QualityMetrics {
  /** Fraction of retrieved items that are relevant (TP / (TP + FP)) */
  precision: number;
  /** Fraction of relevant items that were retrieved (TP / (TP + FN)) */
  recall: number;
  /** Rate of retrieving stale/outdated memories */
  staleHitRate: number;
  /** Rate of retaining constraint-based memories correctly */
  constraintRetention: number;
  /** F1 score (harmonic mean of precision and recall) */
  f1Score: number;
  /** Confidence score (0-1) for the overall retrieval quality */
  confidence: number;
}

/**
 * A single test case for memory quality evaluation.
 */
export interface QualityTestCase {
  /** Unique identifier for the test case */
  id: string;
  /** Human-readable description */
  description: string;
  /** Query or context for retrieval */
  query: string;
  /** Expected memory IDs that should be retrieved */
  expectedIds: string[];
  /** IDs that should NOT be retrieved (known negatives) */
  negativeIds?: string[];
  /** IDs of stale memories that should be filtered out */
  staleIds?: string[];
  /** IDs of constraint-based memories that must be retained */
  constraintIds?: string[];
  /** Tags for categorizing the test */
  tags?: string[];
}

/**
 * Result of evaluating a single test case.
 */
export interface TestCaseResult {
  /** Test case ID */
  testId: string;
  /** Whether the test passed threshold requirements */
  passed: boolean;
  /** Computed metrics for this test */
  metrics: QualityMetrics;
  /** IDs that were correctly retrieved */
  truePositives: string[];
  /** IDs that were incorrectly retrieved */
  falsePositives: string[];
  /** IDs that should have been retrieved but weren't */
  falseNegatives: string[];
  /** Stale IDs that were incorrectly retrieved */
  staleHits: string[];
  /** Constraint IDs that were correctly retained */
  constraintsRetained: string[];
  /** Constraint IDs that were incorrectly dropped */
  constraintsDropped: string[];
}

/**
 * A benchmark suite containing multiple test cases.
 */
export interface BenchmarkSuite {
  /** Suite name */
  name: string;
  /** Suite version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Test cases in this suite */
  testCases: QualityTestCase[];
}

/**
 * Result of running a full benchmark suite.
 */
export interface BenchmarkResult {
  /** Suite name */
  suiteName: string;
  /** Timestamp of the run */
  timestamp: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Individual test results */
  testResults: TestCaseResult[];
  /** Aggregate metrics across all tests */
  aggregateMetrics: QualityMetrics;
  /** Number of tests that passed */
  passed: number;
  /** Total number of tests */
  total: number;
  /** Pass rate (passed / total) */
  passRate: number;
}

// ─── Evaluation Functions ────────────────────────────────────

/**
 * Evaluate retrieval quality by comparing expected vs actual results.
 *
 * @param expected - Expected memory IDs that should be retrieved
 * @param actual - Actually retrieved memory IDs
 * @param options - Additional evaluation options
 */
export function evaluateRetrieval(
  expected: string[],
  actual: string[],
  options: {
    negativeIds?: string[];
    staleIds?: string[];
    constraintIds?: string[];
  } = {},
): QualityMetrics {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const negativeSet = new Set(options.negativeIds ?? []);
  const staleSet = new Set(options.staleIds ?? []);
  const constraintSet = new Set(options.constraintIds ?? []);

  // True positives: retrieved AND expected
  const truePositives = actual.filter((id) => expectedSet.has(id));

  // False positives: retrieved but NOT expected (and not in negative set for penalty)
  const falsePositives = actual.filter((id) => !expectedSet.has(id));

  // False negatives: expected but NOT retrieved
  const falseNegatives = expected.filter((id) => !actualSet.has(id));

  // Precision: TP / (TP + FP)
  const precision = actual.length > 0 ? truePositives.length / actual.length : 1;

  // Recall: TP / (TP + FN)
  const recall = expected.length > 0 ? truePositives.length / expected.length : 1;

  // F1 Score: harmonic mean of precision and recall
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Stale hit rate: how many stale items were incorrectly retrieved
  const staleHits = actual.filter((id) => staleSet.has(id));
  const staleHitRate = staleSet.size > 0 ? staleHits.length / staleSet.size : 0;

  // Constraint retention: how many constraint items were correctly retained
  const constraintsRetained = actual.filter((id) => constraintSet.has(id));
  const constraintRetention = constraintSet.size > 0 ? constraintsRetained.length / constraintSet.size : 1;

  // Overall confidence based on weighted metrics
  const confidence = calculateConfidence({
    precision,
    recall,
    staleHitRate,
    constraintRetention,
  });

  return {
    precision,
    recall,
    staleHitRate,
    constraintRetention,
    f1Score,
    confidence,
  };
}

/**
 * Calculate overall confidence score from individual metrics.
 */
function calculateConfidence(metrics: {
  precision: number;
  recall: number;
  staleHitRate: number;
  constraintRetention: number;
}): number {
  // Weighted combination favoring precision and constraint retention
  const weights = {
    precision: 0.3,
    recall: 0.25,
    staleHitRate: 0.2, // Inverted: lower is better
    constraintRetention: 0.25,
  };

  const score =
    weights.precision * metrics.precision +
    weights.recall * metrics.recall +
    weights.staleHitRate * (1 - metrics.staleHitRate) + // Invert stale rate
    weights.constraintRetention * metrics.constraintRetention;

  return Math.max(0, Math.min(1, score));
}

// ─── Benchmark Class ─────────────────────────────────────────

/**
 * Runs quality benchmarks against a retrieval function.
 */
export class QualityBenchmark {
  private suites: BenchmarkSuite[] = [];
  private results: BenchmarkResult[] = [];
  private confidenceThreshold: number;

  constructor(options: { confidenceThreshold?: number } = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? 0.7;
  }

  /**
   * Load a benchmark suite from a JSON file.
   */
  async loadSuite(filePath: string): Promise<BenchmarkSuite> {
    const content = await readFile(filePath, 'utf-8');
    const suite = JSON.parse(content) as BenchmarkSuite;
    this.suites.push(suite);
    return suite;
  }

  /**
   * Load all benchmark suites from the default benchmarks directory.
   */
  async loadDefaultSuites(cwd?: string): Promise<BenchmarkSuite[]> {
    const benchmarksDir = join(localConfigDir(cwd), 'benchmarks');
    const defaultDir = join(import.meta.dirname, 'benchmarks');

    const dirs = [benchmarksDir, defaultDir];
    const loaded: BenchmarkSuite[] = [];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;

      const { readdir } = await import('node:fs/promises');
      const files = await readdir(dir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const suite = await this.loadSuite(join(dir, file));
          loaded.push(suite);
        }
      }
    }

    return loaded;
  }

  /**
   * Run a single test case with a retrieval function.
   *
   * @param testCase - The test case to run
   * @param retrievalFn - Function that takes a query and returns retrieved IDs
   */
  async runTestCase(
    testCase: QualityTestCase,
    retrievalFn: (query: string) => Promise<string[]>,
  ): Promise<TestCaseResult> {
    const actualIds = await retrievalFn(testCase.query);

    const metrics = evaluateRetrieval(testCase.expectedIds, actualIds, {
      negativeIds: testCase.negativeIds,
      staleIds: testCase.staleIds,
      constraintIds: testCase.constraintIds,
    });

    const expectedSet = new Set(testCase.expectedIds);
    const actualSet = new Set(actualIds);
    const staleSet = new Set(testCase.staleIds ?? []);
    const constraintSet = new Set(testCase.constraintIds ?? []);

    const truePositives = actualIds.filter((id) => expectedSet.has(id));
    const falsePositives = actualIds.filter((id) => !expectedSet.has(id));
    const falseNegatives = testCase.expectedIds.filter((id) => !actualSet.has(id));
    const staleHits = actualIds.filter((id) => staleSet.has(id));
    const constraintsRetained = actualIds.filter((id) => constraintSet.has(id));
    const constraintsDropped = (testCase.constraintIds ?? []).filter((id) => !actualSet.has(id));

    const passed = metrics.confidence >= this.confidenceThreshold;

    return {
      testId: testCase.id,
      passed,
      metrics,
      truePositives,
      falsePositives,
      falseNegatives,
      staleHits,
      constraintsRetained,
      constraintsDropped,
    };
  }

  /**
   * Run all test cases in a suite.
   */
  async runSuite(
    suite: BenchmarkSuite,
    retrievalFn: (query: string) => Promise<string[]>,
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    for (const testCase of suite.testCases) {
      const result = await this.runTestCase(testCase, retrievalFn);
      testResults.push(result);
    }

    const durationMs = Date.now() - startTime;
    const passed = testResults.filter((r) => r.passed).length;
    const total = testResults.length;

    // Compute aggregate metrics
    const aggregateMetrics = this.aggregateMetrics(testResults);

    const result: BenchmarkResult = {
      suiteName: suite.name,
      timestamp: new Date().toISOString(),
      durationMs,
      testResults,
      aggregateMetrics,
      passed,
      total,
      passRate: total > 0 ? passed / total : 0,
    };

    this.results.push(result);
    return result;
  }

  /**
   * Run all loaded suites.
   */
  async runAll(retrievalFn: (query: string) => Promise<string[]>): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const suite of this.suites) {
      const result = await this.runSuite(suite, retrievalFn);
      results.push(result);
    }

    return results;
  }

  /**
   * Get the last benchmark results.
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }

  /**
   * Save results to a file.
   */
  async saveResults(filePath: string): Promise<void> {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(this.results, null, 2) + '\n', 'utf-8');
  }

  /**
   * Load results from a file.
   */
  async loadResults(filePath: string): Promise<BenchmarkResult[]> {
    if (!existsSync(filePath)) {
      return [];
    }
    const content = await readFile(filePath, 'utf-8');
    this.results = JSON.parse(content) as BenchmarkResult[];
    return this.results;
  }

  /**
   * Aggregate metrics across multiple test results.
   */
  private aggregateMetrics(results: TestCaseResult[]): QualityMetrics {
    if (results.length === 0) {
      return {
        precision: 0,
        recall: 0,
        staleHitRate: 0,
        constraintRetention: 0,
        f1Score: 0,
        confidence: 0,
      };
    }

    const sum = {
      precision: 0,
      recall: 0,
      staleHitRate: 0,
      constraintRetention: 0,
      f1Score: 0,
      confidence: 0,
    };

    for (const result of results) {
      sum.precision += result.metrics.precision;
      sum.recall += result.metrics.recall;
      sum.staleHitRate += result.metrics.staleHitRate;
      sum.constraintRetention += result.metrics.constraintRetention;
      sum.f1Score += result.metrics.f1Score;
      sum.confidence += result.metrics.confidence;
    }

    const count = results.length;
    return {
      precision: sum.precision / count,
      recall: sum.recall / count,
      staleHitRate: sum.staleHitRate / count,
      constraintRetention: sum.constraintRetention / count,
      f1Score: sum.f1Score / count,
      confidence: sum.confidence / count,
    };
  }
}
