import { describe, expect, it } from 'vitest';
import { DEFAULT_SLO_CONFIG, type SLOComplianceStatus, type SLOReport } from '../../slo/index.js';
import {
  formatSloConfigJson,
  formatSloReportJson,
  formatSloStatusJson,
  type SloConfigJson,
  type SloReportJson,
  type SloStatusJson,
} from '../slo.js';

const compliance: SLOComplianceStatus = {
  namespace_key: 'org:app:agent',
  is_compliant: false,
  freshness_compliance_percent: 80,
  relevance_compliance_percent: 90,
  recall_compliance_percent: 70,
  cross_session_success_percent: 50,
  failure_count: 2,
  evaluated_at: '2026-09-05T12:00:00.000Z',
  slo_config: DEFAULT_SLO_CONFIG,
  violations: [
    {
      slo_type: 'freshness',
      actual_value: 80,
      required_value: 95,
      severity: 'warning',
      description: 'freshness below target',
    },
  ],
};

const emptyReport: SLOReport = {
  report_id: 'slo_empty',
  period_start: '2026-08-29T00:00:00.000Z',
  period_end: '2026-09-05T00:00:00.000Z',
  total_queries: 0,
  fresh_queries: 0,
  relevant_queries: 0,
  successful_recalls: 0,
  cross_session_attempts: 0,
  cross_session_successes: 0,
  total_failures: 0,
  failures_by_reason: {
    no_matches: 0,
    all_stale: 0,
    below_relevance_threshold: 0,
    cross_session_unavailable: 0,
    storage_error: 0,
    timeout: 0,
    embedding_unavailable: 0,
    namespace_not_found: 0,
    quota_exceeded: 0,
  },
  avg_staleness_score: 0,
  namespace_compliance: [],
  generated_at: '2026-09-05T12:00:00.000Z',
};

describe('savestate slo --json', () => {
  it('prints compliance metrics as JSON', () => {
    const parsed = JSON.parse(formatSloStatusJson(compliance)) as SloStatusJson;
    expect(parsed.enabled).toBe(true);
    expect(parsed.namespace).toBe('org:app:agent');
    expect(parsed.compliant).toBe(false);
    expect(parsed.evaluatedAt).toBe('2026-09-05T12:00:00.000Z');
    expect(parsed.freshness).toBe(80);
    expect(parsed.relevance).toBe(90);
    expect(parsed.recall).toBe(70);
    expect(parsed.crossSession).toBe(50);
    expect(parsed.failures).toBe(2);
    expect(parsed.violations).toBe(1);
  });

  it('records empty violations as 0', () => {
    const parsed = JSON.parse(
      formatSloStatusJson({ ...compliance, is_compliant: true, violations: [], failure_count: 0 }),
    ) as SloStatusJson;
    expect(parsed.compliant).toBe(true);
    expect(parsed.failures).toBe(0);
    expect(parsed.violations).toBe(0);
  });

  it('prints scoring thresholds as JSON', () => {
    const parsed = JSON.parse(formatSloConfigJson(DEFAULT_SLO_CONFIG)) as SloConfigJson;
    expect(parsed.enabled).toBe(true);
    expect(parsed.alertThresholdPercent).toBe(10);
    expect(parsed.evaluationIntervalMinutes).toBe(60);
    expect(parsed.freshness.maxAgeHours).toBe(2160);
    expect(parsed.freshness.relevanceThreshold).toBe(0.3);
    expect(parsed.freshness.recallTargetPercent).toBe(95);
  });

  it('records empty reports with zero counts', () => {
    const parsed = JSON.parse(formatSloReportJson(emptyReport)) as SloReportJson;
    expect(parsed.reportId).toBe('slo_empty');
    expect(parsed.periodStart).toBe('2026-08-29T00:00:00.000Z');
    expect(parsed.periodEnd).toBe('2026-09-05T00:00:00.000Z');
    expect(parsed.totalQueries).toBe(0);
    expect(parsed.freshQueries).toBe(0);
    expect(parsed.relevantQueries).toBe(0);
    expect(parsed.successfulRecalls).toBe(0);
    expect(parsed.totalFailures).toBe(0);
    expect(parsed.avgStalenessScore).toBe(0);
    expect(parsed.namespaces).toBe(0);
  });
});
