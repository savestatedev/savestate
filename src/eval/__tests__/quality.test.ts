/**
 * Memory quality evaluation tests
 */

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateRetrieval,
  QualityBenchmark,
  type BenchmarkSuite,
  type QualityMetrics,
} from '../quality.js';

describe('evaluateRetrieval', () => {
  it('calculates perfect precision and recall for exact match', () => {
    const expected = ['a', 'b', 'c'];
    const actual = ['a', 'b', 'c'];

    const metrics = evaluateRetrieval(expected, actual);

    expect(metrics.precision).toBe(1);
    expect(metrics.recall).toBe(1);
    expect(metrics.f1Score).toBe(1);
  });

  it('calculates zero recall when nothing retrieved', () => {
    const expected = ['a', 'b', 'c'];
    const actual: string[] = [];

    const metrics = evaluateRetrieval(expected, actual);

    expect(metrics.precision).toBe(1); // No false positives
    expect(metrics.recall).toBe(0);
    expect(metrics.f1Score).toBe(0);
  });

  it('calculates zero precision when all wrong', () => {
    const expected = ['a', 'b', 'c'];
    const actual = ['x', 'y', 'z'];

    const metrics = evaluateRetrieval(expected, actual);

    expect(metrics.precision).toBe(0);
    expect(metrics.recall).toBe(0);
    expect(metrics.f1Score).toBe(0);
  });

  it('calculates partial precision and recall', () => {
    const expected = ['a', 'b', 'c', 'd'];
    const actual = ['a', 'b', 'x', 'y'];

    const metrics = evaluateRetrieval(expected, actual);

    // 2 true positives out of 4 retrieved = 0.5 precision
    expect(metrics.precision).toBe(0.5);
    // 2 true positives out of 4 expected = 0.5 recall
    expect(metrics.recall).toBe(0.5);
    // F1 = 2 * 0.5 * 0.5 / (0.5 + 0.5) = 0.5
    expect(metrics.f1Score).toBe(0.5);
  });

  it('tracks stale hit rate', () => {
    const expected = ['a', 'b'];
    const actual = ['a', 'b', 'stale1', 'stale2'];
    const staleIds = ['stale1', 'stale2', 'stale3'];

    const metrics = evaluateRetrieval(expected, actual, { staleIds });

    // 2 stale hits out of 3 stale items
    expect(metrics.staleHitRate).toBeCloseTo(2 / 3);
  });

  it('tracks constraint retention', () => {
    const expected = ['a', 'b', 'constraint1', 'constraint2'];
    const actual = ['a', 'b', 'constraint1'];
    const constraintIds = ['constraint1', 'constraint2'];

    const metrics = evaluateRetrieval(expected, actual, { constraintIds });

    // 1 constraint retained out of 2
    expect(metrics.constraintRetention).toBe(0.5);
  });

  it('handles empty inputs gracefully', () => {
    const metrics = evaluateRetrieval([], []);

    expect(metrics.precision).toBe(1);
    expect(metrics.recall).toBe(1);
    expect(metrics.staleHitRate).toBe(0);
    expect(metrics.constraintRetention).toBe(1);
  });

  it('calculates confidence score', () => {
    const expected = ['a', 'b', 'c'];
    const actual = ['a', 'b', 'c'];

    const metrics = evaluateRetrieval(expected, actual);

    // Perfect retrieval should have high confidence
    expect(metrics.confidence).toBeGreaterThan(0.9);
  });
});

describe('QualityBenchmark', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = join(
      tmpdir(),
      `savestate-eval-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(workDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(workDir)) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('runs a test case and computes metrics', async () => {
    const benchmark = new QualityBenchmark({ confidenceThreshold: 0.5 });

    const retrievalFn = async (query: string): Promise<string[]> => {
      if (query === 'test query') {
        return ['expected1', 'expected2'];
      }
      return [];
    };

    const result = await benchmark.runTestCase(
      {
        id: 'test-001',
        description: 'Test case',
        query: 'test query',
        expectedIds: ['expected1', 'expected2'],
      },
      retrievalFn,
    );

    expect(result.testId).toBe('test-001');
    expect(result.passed).toBe(true);
    expect(result.metrics.precision).toBe(1);
    expect(result.metrics.recall).toBe(1);
    expect(result.truePositives).toEqual(['expected1', 'expected2']);
    expect(result.falsePositives).toEqual([]);
    expect(result.falseNegatives).toEqual([]);
  });

  it('detects failing tests below threshold', async () => {
    const benchmark = new QualityBenchmark({ confidenceThreshold: 0.9 });

    const retrievalFn = async (): Promise<string[]> => {
      return ['expected1']; // Only returns 1 of 2 expected
    };

    const result = await benchmark.runTestCase(
      {
        id: 'test-002',
        description: 'Partial match test',
        query: 'test query',
        expectedIds: ['expected1', 'expected2'],
      },
      retrievalFn,
    );

    expect(result.passed).toBe(false);
    expect(result.metrics.recall).toBe(0.5);
    expect(result.falseNegatives).toEqual(['expected2']);
  });

  it('loads and runs a benchmark suite', async () => {
    const suite: BenchmarkSuite = {
      name: 'test-suite',
      version: '1.0.0',
      description: 'Test suite',
      testCases: [
        {
          id: 'tc-001',
          description: 'Test 1',
          query: 'query1',
          expectedIds: ['a', 'b'],
        },
        {
          id: 'tc-002',
          description: 'Test 2',
          query: 'query2',
          expectedIds: ['c', 'd'],
        },
      ],
    };

    const suitePath = join(workDir, 'test-suite.json');
    await writeFile(suitePath, JSON.stringify(suite));

    const benchmark = new QualityBenchmark({ confidenceThreshold: 0.5 });
    await benchmark.loadSuite(suitePath);

    const retrievalFn = async (query: string): Promise<string[]> => {
      if (query === 'query1') return ['a', 'b'];
      if (query === 'query2') return ['c', 'd'];
      return [];
    };

    const results = await benchmark.runAll(retrievalFn);

    expect(results).toHaveLength(1);
    expect(results[0].suiteName).toBe('test-suite');
    expect(results[0].passed).toBe(2);
    expect(results[0].total).toBe(2);
    expect(results[0].passRate).toBe(1);
  });

  it('saves and loads results', async () => {
    const benchmark = new QualityBenchmark();
    const resultsPath = join(workDir, 'results.json');

    // Run a simple test
    await benchmark.runTestCase(
      {
        id: 'save-test',
        description: 'Save test',
        query: 'query',
        expectedIds: ['a'],
      },
      async () => ['a'],
    );

    await benchmark.saveResults(resultsPath);

    // Load in new instance
    const benchmark2 = new QualityBenchmark();
    const loaded = await benchmark2.loadResults(resultsPath);

    expect(loaded).toHaveLength(0); // runTestCase doesn't add to results, only runSuite does
  });

  it('aggregates metrics across multiple tests', async () => {
    const suite: BenchmarkSuite = {
      name: 'aggregate-test',
      version: '1.0.0',
      description: 'Aggregation test',
      testCases: [
        {
          id: 'agg-001',
          description: 'Perfect',
          query: 'perfect',
          expectedIds: ['a', 'b'],
        },
        {
          id: 'agg-002',
          description: 'Partial',
          query: 'partial',
          expectedIds: ['c', 'd'],
        },
      ],
    };

    const suitePath = join(workDir, 'aggregate-suite.json');
    await writeFile(suitePath, JSON.stringify(suite));

    const benchmark = new QualityBenchmark({ confidenceThreshold: 0.3 });
    await benchmark.loadSuite(suitePath);

    const retrievalFn = async (query: string): Promise<string[]> => {
      if (query === 'perfect') return ['a', 'b']; // 100% precision/recall
      if (query === 'partial') return ['c']; // 50% recall
      return [];
    };

    const results = await benchmark.runAll(retrievalFn);

    expect(results[0].aggregateMetrics.recall).toBeCloseTo(0.75); // (1 + 0.5) / 2
    expect(results[0].aggregateMetrics.precision).toBe(1); // Both have 100% precision
  });

  it('tracks stale hits and constraint drops in test results', async () => {
    const benchmark = new QualityBenchmark({ confidenceThreshold: 0.3 });

    const result = await benchmark.runTestCase(
      {
        id: 'stale-test',
        description: 'Stale and constraint test',
        query: 'query',
        expectedIds: ['a', 'b'],
        staleIds: ['stale1', 'stale2'],
        constraintIds: ['constraint1', 'constraint2'],
      },
      async () => ['a', 'b', 'stale1', 'constraint1'],
    );

    expect(result.staleHits).toEqual(['stale1']);
    expect(result.constraintsRetained).toEqual(['constraint1']);
    expect(result.constraintsDropped).toEqual(['constraint2']);
  });
});
