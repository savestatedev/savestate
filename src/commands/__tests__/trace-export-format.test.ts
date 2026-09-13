import { describe, expect, it } from 'vitest';
import { parseTraceExportFormat } from '../trace.js';

describe('savestate trace export --format', () => {
  it('defaults to jsonl', () => {
    expect(parseTraceExportFormat(undefined)).toBe('jsonl');
  });

  it('accepts known export formats', () => {
    expect(parseTraceExportFormat('jsonl')).toBe('jsonl');
    expect(parseTraceExportFormat('JSONL')).toBe('jsonl');
    expect(parseTraceExportFormat(' Jsonl ')).toBe('jsonl');
  });

  it.each(['', ' ', 'json', 'csv', 'yaml', '1'])('rejects invalid value %s', (value) => {
    expect(() => parseTraceExportFormat(value)).toThrow(
      `Invalid --format value "${value}". Expected one of: jsonl.`,
    );
  });
});
