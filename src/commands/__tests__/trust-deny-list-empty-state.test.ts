import { describe, expect, it } from 'vitest';
import { formatTrustDenyListEmptyMessage } from '../trust.js';

describe('savestate trust deny list empty pages', () => {
  it('keeps the empty-denylist message when there are no entries', () => {
    expect(formatTrustDenyListEmptyMessage(0)).toBe('No patterns on the denylist.');
  });

  it('distinguishes an exhausted offset from an empty denylist', () => {
    expect(formatTrustDenyListEmptyMessage(3, 3)).toBe(
      'No denylist entries on this page (total: 3; offset: 3). Try a smaller --offset.',
    );
  });
});
