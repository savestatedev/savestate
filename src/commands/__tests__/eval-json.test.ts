import { describe, expect, it } from 'vitest';
import type { BenchmarkResult } from '../../eval/index.js';
import { formatEvalJson, type EvalJson } from '../eval.js';

const recall: BenchmarkResult = {
  suiteName: 'recall',
  timestamp: '2026-09-05T12:00:00.000Z',
  durationMs: 12,
  testResults: [],
  aggregateMetrics: {
    precision: 1,
    recall: 0.5,
    staleHitRate: 0,
    constraintRetention: 1,
    f1Score: 2 / 3,
    confidence: 0.8,
  },
  passed: 1,
  total: 2,
  passRate: 0.5,
};

describe('savestate eval --json', () => {
  it('prints suite totals and aggregate metrics as JSON', () => {
    const parsed = JSON.parse(formatEvalJson([recall])) as EvalJson;
    expect(parsed.suiteCount).toBe(1);
    expect(parsed.passed).toBe(1);
    expect(parsed.total).toBe(2);
    expect(parsed.passRate).toBe(0.5);
    expect(parsed.suites).toEqual([
      {
        name: 'recall',
        timestamp: '2026-09-05T12:00:00.000Z',
        durationMs: 12,
        passed: 1,
        total: 2,
        passRate: 0.5,
        precision: 1,
        recall: 0.5,
        f1Score: 2 / 3,
        staleHitRate: 0,
        constraintRetention: 1,
        confidence: 0.8,
      },
    ]);
  });

  it('records empty suites as [] with zero totals', () => {
    const parsed = JSON.parse(formatEvalJson([])) as EvalJson;
    expect(parsed.suites).toEqual([]);
    expect(parsed.suiteCount).toBe(0);
    expect(parsed.passed).toBe(0);
    expect(parsed.total).toBe(0);
    expect(parsed.passRate).toBe(0);
  });
});
