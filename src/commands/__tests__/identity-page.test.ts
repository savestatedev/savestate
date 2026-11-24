import { describe, expect, it } from 'vitest';
import { parseIdentityPage, resolveIdentityOffset } from '../identity.js';

describe('identity pagination pages', () => {
  it('parses positive 1-based pages', () => {
    expect(parseIdentityPage('2')).toBe(2);
    expect(parseIdentityPage(undefined)).toBeUndefined();
  });

  it('rejects invalid pages and conflicting offset mode', () => {
    expect(() => parseIdentityPage('0')).toThrow('positive integer page number');
    expect(() => resolveIdentityOffset('1', '2', 20)).toThrow(
      'Cannot use --page with --offset',
    );
  });

  it('converts a page to the bounded offset', () => {
    expect(resolveIdentityOffset(undefined, '3', 10)).toBe('20');
    expect(resolveIdentityOffset(undefined, undefined, 10)).toBeUndefined();
  });
});
