import { describe, expect, it } from 'vitest';
import { formatIntegrityQuarantineJson, type IntegrityQuarantineJson } from '../integrity.js';

const result: IntegrityQuarantineJson & { secret?: string; metadata?: unknown } = {
  success: true,
  requiresApproval: false,
  targetId: 'mem-123',
  targetType: 'memory',
  action: 'quarantine_memory',
  reason: 'tripwire hit',
  eventId: 'evt-9',
  error: null,
  secret: 'ss_live_SECRET',
  metadata: { original_content: 'ss_live_SECRET' },
};

describe('savestate integrity quarantine --json', () => {
  it('prints a quarantine summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityQuarantineJson(result)) as IntegrityQuarantineJson & {
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
      action: 'quarantine_memory',
      reason: 'tripwire hit',
      eventId: 'evt-9',
      error: null,
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.event).toBeUndefined();
    expect(parsed.originalContent).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a failed quarantine without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityQuarantineJson({
        success: false,
        requiresApproval: false,
        targetId: 'agent_1',
        targetType: 'agent',
        action: 'quarantine_agent',
        reason: 'Manual quarantine via CLI',
        eventId: 'evt-10',
        error: 'Agent is already quarantined',
      }),
    ) as IntegrityQuarantineJson;
    expect(parsed.success).toBe(false);
    expect(parsed.targetType).toBe('agent');
    expect(parsed.error).toBe('Agent is already quarantined');
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
