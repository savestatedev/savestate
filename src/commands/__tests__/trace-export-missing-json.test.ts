import { describe, expect, it } from 'vitest';
import {
  formatTraceExportMissingJson,
  type TraceExportMissingJson,
} from '../trace.js';

describe('savestate trace export --json when missing', () => {
  it('prints a missing run export summary with pagination metadata', () => {
    const parsed = JSON.parse(
      formatTraceExportMissingJson('run-missing', 'jsonl', 4, 2),
    ) as TraceExportMissingJson & {
      runs?: unknown;
      secret?: unknown;
      file?: unknown;
      payload?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      format: 'jsonl',
      run: 'run-missing',
      runCount: 0,
      eventCount: 0,
      pagination: {
        offset: 4,
        limit: 2,
        total: 0,
        shown: 0,
        emptyReason: 'collection',
        hasMore: false,
        nextOffset: null,
        hasPrevious: true,
        previousOffset: 2,
        suggestedOffset: null,
      },
    });
    expect(parsed.runs).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.file).toBeUndefined();
    expect(parsed.payload).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'eventCount',
      'format',
      'found',
      'pagination',
      'run',
      'runCount',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
