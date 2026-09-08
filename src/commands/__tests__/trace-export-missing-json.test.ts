import { describe, expect, it } from 'vitest';
import {
  formatTraceExportMissingJson,
  type TraceExportMissingJson,
} from '../trace.js';

describe('savestate trace export --json when missing', () => {
  it('prints a missing run export summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatTraceExportMissingJson('run-missing', 'jsonl'),
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
    });
    expect(parsed.runs).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.file).toBeUndefined();
    expect(parsed.payload).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'eventCount',
      'format',
      'found',
      'run',
      'runCount',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
