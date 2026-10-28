const MAX_SEARCH_SNAPSHOTS_LIMIT = 1000;

/** Parse savestate_search_snapshots limit without turning user input errors into an unbounded snapshot search. */
export function parseSearchSnapshotsLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SEARCH_SNAPSHOTS_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SEARCH_SNAPSHOTS_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N matches when savestate_search_snapshots limit is set. */
export function selectSearchSnapshotsEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Return one bounded page and whether another page is available. */
export function selectSearchSnapshotsPage<T>(
  entries: T[],
  limit: number,
): { entries: T[]; hasNextPage: boolean } {
  const page = entries.slice(0, limit);
  return {
    entries: page,
    hasNextPage: entries.length > page.length,
  };
}

/** Return the nearest earlier page offset, when the current page is not first. */
export function getSearchSnapshotsPreviousOffset(
  offset: number,
  limit: number,
): number | undefined {
  if (offset <= 0) return undefined;
  return Math.max(0, offset - limit);
}

/** Return the last populated page offset when a requested page is empty. */
export function getSearchSnapshotsSuggestedOffset(
  totalEntries: number,
  limit: number,
): number | undefined {
  if (totalEntries <= 0) return undefined;
  return Math.floor((totalEntries - 1) / limit) * limit;
}

/** Describe the available navigation from a populated search page. */
export function formatSearchSnapshotsPageHints(
  offset: number,
  limit: number,
  shown: number,
  hasNextPage: boolean,
): string[] {
  const lines: string[] = [];
  const previousOffset = getSearchSnapshotsPreviousOffset(offset, limit);
  if (previousOffset !== undefined) {
    lines.push(`Previous page: try offset ${previousOffset}.`);
  }
  if (hasNextPage) {
    lines.push(`More matches available. Try offset ${offset + shown}.`);
  } else {
    lines.push('No more matches available.');
  }
  return lines;
}

/** Keep empty filtered searches explicit so callers do not mistake a scoped miss for a global one. */
export function formatSearchSnapshotsEmptyPageMessage(
  offset: number,
  suggestedOffset: number | undefined,
  filters?: { since?: string; until?: string; label?: string; tag?: string },
): string {
  const activeFilters = [
    filters?.since ? `since=${filters.since}` : undefined,
    filters?.until ? `until=${filters.until}` : undefined,
    filters?.label ? `label=${filters.label}` : undefined,
    filters?.tag ? `tag=${filters.tag}` : undefined,
  ].filter((filter): filter is string => filter !== undefined);
  const filterSummary = activeFilters.length > 0
    ? ` Active filters: ${activeFilters.join(', ')}.`
    : '';

  if (offset === 0) return `No matches found across snapshots.${filterSummary}`;
  return `No matches found across snapshots at offset ${offset}.${filterSummary} Try offset ${suggestedOffset ?? 0}.`;
}
