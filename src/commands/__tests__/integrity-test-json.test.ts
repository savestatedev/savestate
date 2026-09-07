import { describe, expect, it } from 'vitest';
import { formatIntegrityTestJson, type IntegrityTestJson } from '../integrity.js';

const result: IntegrityTestJson & { secret?: string; context?: unknown } = {
  triggered: true,
  durationMs: 12,
  eventCount: 1,
  events: [
    {
      id: 'evt-1',
      honeyfactId: 'hf-9',
      confidence: 0.94,
      detectedIn: 'output',
    },
  ],
  incidentId: 'inc-3',
  incidentSeverity: 'high',
  secret: 'ss_live_SECRET',
  context: { matched_content: 'ss_live_SECRET' },
};

describe('savestate integrity test --json', () => {
  it('prints a test summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityTestJson(result)) as IntegrityTestJson & {
      secret?: unknown;
      apiKey?: string;
      context?: unknown;
      matchedContent?: unknown;
      incident?: unknown;
    };
    expect(parsed).toEqual({
      triggered: true,
      durationMs: 12,
      eventCount: 1,
      events: [
        {
          id: 'evt-1',
          honeyfactId: 'hf-9',
          confidence: 0.94,
          detectedIn: 'output',
        },
      ],
      incidentId: 'inc-3',
      incidentSeverity: 'high',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.context).toBeUndefined();
    expect(parsed.matchedContent).toBeUndefined();
    expect(parsed.incident).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a clean test without extra fields', () => {
    const parsed = JSON.parse(
      formatIntegrityTestJson({
        triggered: false,
        durationMs: 4,
        eventCount: 0,
        events: [],
        incidentId: null,
        incidentSeverity: null,
      }),
    ) as IntegrityTestJson;
    expect(parsed.triggered).toBe(false);
    expect(parsed.eventCount).toBe(0);
    expect(parsed.events).toEqual([]);
    expect(parsed.incidentId).toBeNull();
    expect(parsed.incidentSeverity).toBeNull();
    expect(Object.keys(parsed).sort()).toEqual([
      'durationMs',
      'eventCount',
      'events',
      'incidentId',
      'incidentSeverity',
      'triggered',
    ]);
  });
});
