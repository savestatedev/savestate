import { describe, expect, it } from 'vitest';
import type { IntegrityIncident } from '../../integrity/index.js';
import {
  formatIntegrityIncidentJson,
  formatIntegrityIncidentsJson,
  type IntegrityIncidentJson,
} from '../integrity.js';

const incident: IntegrityIncident = {
  id: 'inc-1',
  created_at: '2026-09-04T12:00:00.000Z',
  severity: 'high',
  type: 'honeyfact_leak',
  events: [
    {
      id: 'evt-1',
      timestamp: '2026-09-04T12:00:00.000Z',
      honeyfact_id: 'hf-1',
      detected_in: 'output',
      confidence: 0.95,
      context: {
        matched_content: 'ss_live_SECRET',
        surrounding: 'Authorization: Bearer ss_live_SECRET',
        tool_args: { token: 'ss_live_SECRET' },
      },
      tenant_id: 'default',
    },
  ],
  status: 'open',
  tenant_id: 'default',
  updated_at: '2026-09-04T12:00:00.000Z',
};

describe('savestate integrity --json', () => {
  it('prints incidents as JSON without event match context', () => {
    const parsed = JSON.parse(formatIntegrityIncidentsJson([incident])) as Array<
      IntegrityIncidentJson & { events?: unknown; matched_content?: unknown }
    >;
    expect(parsed).toEqual([
      {
        id: 'inc-1',
        createdAt: '2026-09-04T12:00:00.000Z',
        severity: 'high',
        type: 'honeyfact_leak',
        status: 'open',
        tenantId: 'default',
        updatedAt: '2026-09-04T12:00:00.000Z',
        eventCount: 1,
        resolutionNotes: null,
        resolvedBy: null,
      },
    ]);
    expect(parsed[0].events).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a resolved incident and an empty list', () => {
    const parsed = JSON.parse(
      formatIntegrityIncidentJson({
        ...incident,
        status: 'resolved',
        resolution_notes: 'Contained',
        resolved_by: 'reviewer-1',
        events: [],
      }),
    ) as IntegrityIncidentJson;
    expect(parsed.status).toBe('resolved');
    expect(parsed.resolutionNotes).toBe('Contained');
    expect(parsed.resolvedBy).toBe('reviewer-1');
    expect(parsed.eventCount).toBe(0);
    expect(formatIntegrityIncidentsJson([])).toBe('[]');
  });
});
