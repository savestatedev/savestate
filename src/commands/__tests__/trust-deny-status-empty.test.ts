import { describe, expect, it } from 'vitest';
import { formatTrustDenyStatusEmptyMessage } from '../trust.js';

describe('savestate trust deny status empty pages', () => {
  it('explains when an offset skips past the status fields', () => {
    expect(formatTrustDenyStatusEmptyMessage(3, 3)).toBe(
      'No status fields on this page (total: 3; offset: 3). Try a smaller --offset.',
    );
  });
});
