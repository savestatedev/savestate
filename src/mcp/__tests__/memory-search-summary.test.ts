import { describe, expect, it } from 'vitest';
import {
  formatMemorySearchEmptyPage,
  formatMemorySearchPageSummary,
} from '../memory-search-summary.js';

describe('memory search pagination summaries', () => {
  it('reports the next offset when another page exists', () => {
    expect(formatMemorySearchPageSummary(2, 4, true)).toBe(
      'Found 2 memory(ies) starting at offset 4; next offset 6; more available:',
    );
  });

  it('omits a next offset on the final page', () => {
    expect(formatMemorySearchPageSummary(1, undefined, false)).toBe(
      'Found 1 memory(ies) starting at offset 0:',
    );
  });

  it('preserves the offset for an empty page', () => {
    expect(formatMemorySearchEmptyPage(12)).toBe(
      'No memories found matching your query at offset 12. Try offset 2.',
    );
  });

  it('uses the requested page size for empty-page recovery', () => {
    expect(formatMemorySearchEmptyPage(12, 4)).toBe(
      'No memories found matching your query at offset 12. Try offset 8.',
    );
  });

  it('keeps the first page message focused on the missing query', () => {
    expect(formatMemorySearchEmptyPage(undefined)).toBe(
      'No memories found matching your query at offset 0.',
    );
  });
});
