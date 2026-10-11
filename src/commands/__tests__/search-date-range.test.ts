import { describe, expect, it } from 'vitest';
import { resolveSearchSnapshots, validateSearchDateRange } from '../search.js';

describe('savestate search date range', () => {
  it('rejects --since after --until', () => {
    expect(() => validateSearchDateRange(20, 10, '2026-02-01', '2026-01-01')).toThrow(
      'Invalid search date range: --since (2026-02-01) must be on or before --until (2026-01-01).',
    );
  });

  it('rejects an inverted range before filtering snapshots', () => {
    expect(() =>
      resolveSearchSnapshots(
        [{ id: 'snapshot', timestamp: '2026-01-15T00:00:00Z' }],
        { since: '2026-02-01', until: '2026-01-01' },
      ),
    ).toThrow('Invalid search date range');
  });

  it('allows equal boundaries', () => {
    expect(() => validateSearchDateRange(10, 10, '2026-01-01', '2026-01-01')).not.toThrow();
  });
});
