import { describe, expect, it } from 'vitest';
import { formatDoctorJson, type DoctorJson, type SnapshotDiagnosis } from '../doctor.js';

const healthy: SnapshotDiagnosis = {
  id: 'ss-ok',
  filename: 'ss-ok.saf.enc',
  ok: true,
  incremental: false,
  errors: [],
  warnings: [],
};

const unhealthy: SnapshotDiagnosis = {
  id: 'ss-bad',
  filename: 'ss-bad.saf.enc',
  ok: false,
  incremental: true,
  errors: ['decrypt failed'],
  warnings: ['no checksum in manifest'],
};

describe('savestate doctor --json', () => {
  it('prints diagnosis totals as JSON with per-snapshot results', () => {
    const parsed = JSON.parse(formatDoctorJson([healthy, unhealthy])) as DoctorJson;
    expect(parsed.total).toBe(2);
    expect(parsed.healthy).toBe(1);
    expect(parsed.unhealthy).toBe(1);
    expect(parsed.results).toEqual([healthy, unhealthy]);
  });

  it('records empty diagnosis with zero totals', () => {
    const parsed = JSON.parse(formatDoctorJson([])) as DoctorJson;
    expect(parsed.total).toBe(0);
    expect(parsed.healthy).toBe(0);
    expect(parsed.unhealthy).toBe(0);
    expect(parsed.results).toEqual([]);
  });
});
