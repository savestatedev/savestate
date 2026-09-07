import { describe, expect, it } from 'vitest';
import {
  formatTraceShowMissingJson,
  type TraceShowMissingJson,
} from '../trace.js';

describe('savestate trace show --json when missing', () => {
  it('prints a missing run summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTraceShowMissingJson('run-123')) as TraceShowMissingJson & {
      events?: unknown;
      payload?: unknown;
      secret?: unknown;
      file?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      runId: 'run-123',
      adapter: null,
      eventCount: 0,
    });
    expect(parsed.events).toBeUndefined();
    expect(parsed.payload).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.file).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['adapter', 'eventCount', 'found', 'runId']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
