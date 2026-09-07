import { describe, expect, it } from 'vitest';
import { formatIntegrityReleaseJson, type IntegrityReleaseJson } from '../integrity.js';

const result: IntegrityReleaseJson & { secret?: string; metadata?: unknown } = {
  success: true,
  requiresApproval: false,
  targetId: 'mem-123',
  targetType: 'memory',
  action: 'release_memory',
  reason: 'Released via CLI',
  eventId: 'evt-11',
  error: null,
  secret: 'ss_live_SECRET',
  metadata: { original_content: 'ss_live_SECRET' },
};

describe('savestate integrity release --json', () => {
  it('prints a release summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityReleaseJson(result)) as IntegrityReleaseJson & {
      secret?: unknown;
      apiKey?: string;
      metadata?: unknown;
      event?: unknown;
      originalContent?: unknown;
    };
    expect(parsed).toEqual({
      success: true,
      requiresApproval: false,
      targetId: 'mem-123',
      targetType: 'memory',
      action: 'release_memory',
      reason: 'Released via CLI',
      eventId: 'evt-11',
      error: null,
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.event).toBeUndefined();
    expect(parsed.originalContent).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a failed release without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityReleaseJson({
        success: false,
        requiresApproval: false,
        targetId: 'agent_1',
        targetType: 'agent',
        action: 'release_agent',
        reason: 'Released via CLI',
        eventId: 'evt-12',
        error: 'Agent is not in quarantine',
      }),
    ) as IntegrityReleaseJson;
    expect(parsed.success).toBe(false);
    expect(parsed.targetType).toBe('agent');
    expect(parsed.error).toBe('Agent is not in quarantine');
    expect(Object.keys(parsed).sort()).toEqual([
      'action',
      'error',
      'eventId',
      'reason',
      'requiresApproval',
      'success',
      'targetId',
      'targetType',
    ]);
  });
});
