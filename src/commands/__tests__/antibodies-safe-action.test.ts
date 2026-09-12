import { describe, expect, it } from 'vitest';
import { parseAntibodiesSafeAction } from '../antibodies.js';

describe('savestate antibodies add --safe-action', () => {
  it('defaults to validate_inputs', () => {
    expect(parseAntibodiesSafeAction(undefined)).toBe('validate_inputs');
  });

  it('accepts known safe action types', () => {
    expect(parseAntibodiesSafeAction('retry_with_backoff')).toBe('retry_with_backoff');
    expect(parseAntibodiesSafeAction('check_permissions')).toBe('check_permissions');
    expect(parseAntibodiesSafeAction('validate_inputs')).toBe('validate_inputs');
    expect(parseAntibodiesSafeAction('RUN_READ_ONLY_PROBE')).toBe('run_read_only_probe');
    expect(parseAntibodiesSafeAction('confirm_with_user')).toBe('confirm_with_user');
  });

  it.each(['', ' ', 'nope', 'delete', '1'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesSafeAction(value)).toThrow(
      `Invalid --safe-action value "${value}". Expected one of: retry_with_backoff, check_permissions, validate_inputs, run_read_only_probe, confirm_with_user.`,
    );
  });
});
