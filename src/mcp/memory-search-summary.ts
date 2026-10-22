/** Format a compact page summary for memory search responses. */
export function formatMemorySearchPageSummary(
  shown: number,
  offset: number | undefined,
  hasMore: boolean,
): string {
  const start = offset ?? 0;
  const more = hasMore ? `; next offset ${start + shown}; more available` : '';
  return `Found ${shown} memory(ies) starting at offset ${start}${more}:`;
}

/** Explain an empty search page without losing the caller's pagination position. */
export function formatMemorySearchEmptyPage(offset: number | undefined): string {
  return `No memories found matching your query at offset ${offset ?? 0}.`;
}
