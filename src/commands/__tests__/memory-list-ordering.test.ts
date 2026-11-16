import { describe, expect, it } from 'vitest';
import { validateMemoryListOrdering } from '../memory-cli.js';

describe('savestate memory list ordering', () => {
  it('allows either ordering flag independently', () => {
    expect(() => validateMemoryListOrdering(true, false)).not.toThrow();
    expect(() => validateMemoryListOrdering(false, true)).not.toThrow();
    expect(() => validateMemoryListOrdering(undefined, undefined)).not.toThrow();
  });

  it('rejects contradictory ordering flags', () => {
    expect(() => validateMemoryListOrdering(true, true)).toThrow(
      'Cannot use --oldest-first and --reverse together; choose one ordering flag.',
    );
  });
});
