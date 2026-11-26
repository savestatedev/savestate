import { describe, expect, it } from 'vitest';
import { parseCloudDeleteLimit, parseCloudPullLimit } from '../cloud.js';

describe('cloud pull and delete limits', () => {
  it('rejects malformed limits instead of coercing them', () => {
    expect(() => parseCloudPullLimit('2snapshots')).toThrow('Invalid --limit value');
    expect(() => parseCloudDeleteLimit('')).toThrow('Invalid --limit value');
  });

  it('accepts surrounding whitespace around numeric limits', () => {
    expect(parseCloudPullLimit(' 2 ')).toBe(2);
    expect(parseCloudDeleteLimit(' 3 ')).toBe(3);
  });
});
