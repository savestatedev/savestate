/**
 * Memory Quality Benchmark Suite
 *
 * Runs offline benchmarks for memory retrieval quality evaluation.
 *
 * @see https://github.com/savestatedev/savestate/issues/113
 */

import {
  MemoryQualityGate,
  type BenchmarkResult,
  type MemoryQualityConfig,
  type PrecisionTestCase,
  type RecallTestCase,
  DEFAULT_QUALITY_CONFIG,
} from './gate.js';

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  precisionTests: PrecisionTestCase[];
  recallTests: RecallTestCase[];
  config?: Partial<MemoryQualityConfig>;
}

export interface SuiteResult {
  suiteId: string;
  suiteName: string;
  passed: boolean;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averagePrecision: number;
    averageRecall: number;
    averageF1: number;
  };
  timestamp: string;
}

/**
 * Run a benchmark suite against a retrieval function.
 */
export async function runBenchmarkSuite(
  suite: BenchmarkSuite,
  retrieveMemories: (query: string) => Promise<string[]>,
): Promise<SuiteResult> {
  const config = { ...DEFAULT_QUALITY_CONFIG, ...suite.config };
  const gate = new MemoryQualityGate(config);
  const results: BenchmarkResult[] = [];

  // Run precision tests
  for (const test of suite.precisionTests) {
    const result = gate.runPrecisionTest(test);
    results.push(result);
  }

  // Run recall tests
  for (const test of suite.recallTests) {
    const retrieved = await retrieveMemories(test.query);
    const result = gate.runRecallTest(test, retrieved);
    results.push(result);
  }

  // Calculate summary statistics
  const precisionScores = results
    .filter((r) => r.benchmarkId.startsWith('precision'))
    .map((r) => r.score);
  const recallScores = results
    .filter((r) => r.benchmarkId.startsWith('recall'))
    .map((r) => r.score);

  const avgPrecision =
    precisionScores.length > 0
      ? precisionScores.reduce((a, b) => a + b, 0) / precisionScores.length
      : 0;
  const avgRecall =
    recallScores.length > 0
      ? recallScores.reduce((a, b) => a + b, 0) / recallScores.length
      : 0;
  const avgF1 = gate.calculateF1(avgPrecision, avgRecall);

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.length - passedTests;

  return {
    suiteId: suite.id,
    suiteName: suite.name,
    passed: failedTests === 0,
    results,
    summary: {
      totalTests: results.length,
      passedTests,
      failedTests,
      averagePrecision: avgPrecision,
      averageRecall: avgRecall,
      averageF1: avgF1,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a default benchmark suite for basic quality checks.
 */
export function createDefaultBenchmarkSuite(): BenchmarkSuite {
  return {
    id: 'default',
    name: 'Default Quality Benchmark',
    description: 'Basic precision and recall tests for memory retrieval',
    precisionTests: [],
    recallTests: [],
    config: DEFAULT_QUALITY_CONFIG,
  };
}
