import { describe, expect, it } from 'vitest';
import { parseTraceSubcommand } from '../trace.js';

describe('savestate trace subcommand', () => {
  it('accepts a single trace subcommand', () => {
    expect(parseTraceSubcommand('list')).toBe('list');
    expect(parseTraceSubcommand('show')).toBe('show');
    expect(parseTraceSubcommand('export')).toBe('export');
    expect(parseTraceSubcommand(' LIST ')).toBe('list');
  });

  it.each(['', ' ', ',', 'list,show', 'trace list', 'quality'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTraceSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty trace subcommand (list, show, export).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseTraceSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty trace subcommand (list, show, export).',
    );
  });
});
