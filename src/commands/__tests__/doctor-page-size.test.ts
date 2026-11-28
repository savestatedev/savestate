import { describe, expect, it } from 'vitest';
import { resolveDoctorLimit } from '../doctor.js';

describe('savestate doctor --page-size', () => {
  it('uses --page-size as the limit alias', () => {
    expect(resolveDoctorLimit(undefined, '12')).toBe(12);
  });

  it('rejects combining --limit and --page-size', () => {
    expect(() => resolveDoctorLimit('5', '12')).toThrow(
      'Cannot use --limit with --page-size; choose one page-size option.',
    );
  });
});
