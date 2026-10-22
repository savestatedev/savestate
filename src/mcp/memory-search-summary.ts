/** Format a compact page summary for memory search responses. */
export function formatMemorySearchPageSummary(
  shown: number,
  offset: number | undefined,
  hasMore: boolean,
  pageSize = Math.max(1, shown),
): string {
  const start = offset ?? 0;
  const previous = start > 0
    ? `; previous offset ${Math.max(0, start - pageSize)}`
    : '';
  const more = hasMore ? `; next offset ${start + shown}; more available` : '';
  return `Found ${shown} memory(ies) starting at offset ${start}${previous}${more}:`;
}

/** Explain an empty search page and give callers an actionable recovery offset. */
export function formatMemorySearchEmptyPage(
  offset: number | undefined,
  limit = 10,
): string {
  const start = offset ?? 0;
  if (start === 0) {
    return 'No memories found matching your query at offset 0.';
  }

  return `No memories found matching your query at offset ${start}. Try offset ${Math.max(0, start - limit)}.`;
}
