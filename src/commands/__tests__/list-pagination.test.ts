import { describe, expect, it } from 'vitest';
import { formatListPageSummary } from '../list.js';

describe('list pagination summaries', () => {
  it('explains when more matches exist beyond the supported offset ceiling', () => {
    expect(formatListPageSummary(1200, 100, 1000, 100)).toContain(
      'last page-aligned offset 1000',
    );
    expect(formatListPageSummary(1200, 100, 1000, 100)).toContain('max offset 1000');
  });

  it('keeps offering a next offset while it is still reachable', () => {
    expect(formatListPageSummary(1100, 100, 900, 100)).toContain('next offset 1000');
  });
});
