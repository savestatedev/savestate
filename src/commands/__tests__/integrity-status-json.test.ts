import { describe, expect, it } from 'vitest';
import { formatIntegrityStatusJson, type IntegrityStatusJson } from '../integrity.js';

const result: IntegrityStatusJson & { secret?: string } = {
  enabled: true,
  policy: 'approve',
  honeyfacts: {
    active: 8,
    expired: 2,
    total: 10,
  },
  incidents: {
    open: 1,
    contained: 3,
    resolved: 4,
    events: 12,
  },
  containment: {
    quarantinedMemories: 2,
    quarantinedAgents: 0,
    pendingApprovals: 1,
    lastActionAt: '2026-09-07T12:00:00.000Z',
  },
  secret: 'ss_live_SECRET',
};

describe('savestate integrity status --json', () => {
  it('prints a status summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityStatusJson(result)) as IntegrityStatusJson & {
      secret?: unknown;
      apiKey?: string;
      recent_events?: unknown;
      by_category?: unknown;
    };
    expect(parsed).toEqual({
      enabled: true,
      policy: 'approve',
      honeyfacts: {
        active: 8,
        expired: 2,
        total: 10,
      },
      incidents: {
        open: 1,
        contained: 3,
        resolved: 4,
        events: 12,
      },
      containment: {
        quarantinedMemories: 2,
        quarantinedAgents: 0,
        pendingApprovals: 1,
        lastActionAt: '2026-09-07T12:00:00.000Z',
      },
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.recent_events).toBeUndefined();
    expect(parsed.by_category).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a disabled grid without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityStatusJson({
        enabled: false,
        policy: 'observe',
        honeyfacts: { active: 0, expired: 0, total: 0 },
        incidents: { open: 0, contained: 0, resolved: 0, events: 0 },
        containment: {
          quarantinedMemories: 0,
          quarantinedAgents: 0,
          pendingApprovals: 0,
          lastActionAt: null,
        },
      }),
    ) as IntegrityStatusJson;
    expect(parsed.enabled).toBe(false);
    expect(parsed.policy).toBe('observe');
    expect(parsed.containment.lastActionAt).toBeNull();
    expect(Object.keys(parsed).sort()).toEqual([
      'containment',
      'enabled',
      'honeyfacts',
      'incidents',
      'policy',
    ]);
  });
});
