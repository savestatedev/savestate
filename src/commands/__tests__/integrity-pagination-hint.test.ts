import { describe, expect, it } from 'vitest';
import { formatIntegrityIncidentPaginationHint } from '../integrity.js';

describe('savestate integrity incidents pagination hints', () => {
  it('reports next and previous offsets for a populated page', () => {
    expect(formatIntegrityIncidentPaginationHint(5, 12, 5, 5)).toBe(
      'Showing 5 of 12 incidents (offset 5, limit 5); next offset 10; previous offset 0.',
    );
  });

  it('suggests the nearest valid page when the offset is past the collection', () => {
    expect(formatIntegrityIncidentPaginationHint(0, 12, 20, 5)).toBe(
      'Showing 0 of 12 incidents (offset 20, limit 5); previous offset 15; try offset 10.',
    );
  });

  it('omits pagination noise for an unpaged complete result', () => {
    expect(formatIntegrityIncidentPaginationHint(2, 2)).toBe('');
  });
});
