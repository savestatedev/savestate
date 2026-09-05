import { describe, expect, it } from 'vitest';
import { formatTrustJson, type TrustJson } from '../trust.js';
import type { TrustMetrics } from '../../trust-kernel/types.js';

const populated: TrustMetrics = {
  entriesByState: {
    candidate: 2,
    stable: 5,
    rejected: 1,
    quarantined: 0,
    revoked: 0,
  },
  entriesByScope: {
    semantic: 4,
    procedural: 3,
    episodic: 1,
  },
  promotionsLastHour: 3,
  rejectionsLastHour: 1,
  avgPromotionLatencyMs: 12,
  writeGateP95Ms: 4,
  actionGateP95Ms: 8,
  denylistSize: 2,
  criticalBreaches: 0,
};

describe('savestate trust --json', () => {
  it('prints Trust Kernel metrics as JSON', () => {
    const parsed = JSON.parse(formatTrustJson(populated)) as TrustJson;
    expect(parsed.entriesByState).toEqual(populated.entriesByState);
    expect(parsed.entriesByScope).toEqual(populated.entriesByScope);
    expect(parsed.promotionsLastHour).toBe(3);
    expect(parsed.rejectionsLastHour).toBe(1);
    expect(parsed.denylistSize).toBe(2);
    expect(parsed.avgPromotionLatencyMs).toBe(12);
    expect(parsed.writeGateP95Ms).toBe(4);
    expect(parsed.actionGateP95Ms).toBe(8);
    expect(parsed.criticalBreaches).toBe(0);
  });

  it('fills missing state and scope counts with zeros', () => {
    const parsed = JSON.parse(
      formatTrustJson({
        entriesByState: { candidate: 1 } as TrustMetrics['entriesByState'],
        entriesByScope: { semantic: 1 } as TrustMetrics['entriesByScope'],
        promotionsLastHour: 0,
        rejectionsLastHour: 0,
        avgPromotionLatencyMs: 0,
        writeGateP95Ms: 0,
        actionGateP95Ms: 0,
        denylistSize: 0,
        criticalBreaches: 0,
      }),
    ) as TrustJson;
    expect(parsed.entriesByState).toEqual({
      candidate: 1,
      stable: 0,
      rejected: 0,
      quarantined: 0,
      revoked: 0,
    });
    expect(parsed.entriesByScope).toEqual({
      semantic: 1,
      procedural: 0,
      episodic: 0,
    });
    expect(parsed.denylistSize).toBe(0);
  });
});
