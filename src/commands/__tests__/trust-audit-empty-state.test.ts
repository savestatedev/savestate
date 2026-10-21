import { describe, expect, it } from 'vitest';
import { formatTrustAuditEmptyMessage } from '../trust.js';

describe('savestate trust audit empty pages', () => {
  it('keeps the empty-history message when there are no events', () => {
    expect(formatTrustAuditEmptyMessage(0)).toBe('No transitions recorded yet.');
  });

  it('distinguishes an exhausted offset from empty history', () => {
    expect(formatTrustAuditEmptyMessage(4, 4)).toBe(
      'No audit events on this page (total: 4; offset: 4). Try a smaller --offset.',
    );
  });
});
