import { describe, expect, it } from 'vitest';
import { parseEvalSubcommand } from '../eval.js';

describe('savestate eval subcommand', () => {
  it('accepts a single eval subcommand', () => {
    expect(parseEvalSubcommand('quality')).toBe('quality');
    expect(parseEvalSubcommand('report')).toBe('report');
    expect(parseEvalSubcommand(' REPORT ')).toBe('report');
  });

  it.each(['', ' ', ',', 'quality,report', 'eval quality', 'status'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseEvalSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty eval subcommand (quality, report).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseEvalSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty eval subcommand (quality, report).',
    );
  });
});
