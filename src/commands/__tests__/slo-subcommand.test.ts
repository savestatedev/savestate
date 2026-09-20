import { describe, expect, it } from 'vitest';
import { parseSloSubcommand } from '../slo.js';

describe('savestate slo subcommand', () => {
  it('accepts a single slo subcommand', () => {
    expect(parseSloSubcommand('status')).toBe('status');
    expect(parseSloSubcommand('report')).toBe('report');
    expect(parseSloSubcommand('config')).toBe('config');
    expect(parseSloSubcommand(' REPORT ')).toBe('report');
  });

  it.each(['', ' ', ',', 'status,report', 'slo status', 'quality'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSloSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty slo subcommand (status, report, config).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseSloSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty slo subcommand (status, report, config).',
    );
  });
});
