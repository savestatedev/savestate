const MAX_SAVESTATE_LIST_LIMIT = 1000;

/** Parse savestate_list limit without turning user input errors into an unbounded snapshot list. */
export function parseSavestateListLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SAVESTATE_LIST_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SAVESTATE_LIST_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N snapshots when savestate_list limit is set. */
export function selectSavestateListEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Match platform identifiers without making callers reproduce their casing. */
export function matchesSavestateListPlatform(
  entryPlatform: string,
  requestedPlatform: string,
): boolean {
  return entryPlatform.toLowerCase() === requestedPlatform.toLowerCase();
}

/** Format a compact page summary for MCP clients and humans reading the tool response. */
export function formatSavestateListPageSummary(
  shown: number,
  total: number,
  offset: number | undefined,
  hasMore: boolean,
): string {
  const start = offset ?? 0;
  const more = hasMore ? `; next offset ${start + shown}; more available` : '';
  return `Snapshots (${shown} shown of ${total} total, starting at ${start}${more}):`;
}

/** Explain an empty page and point callers at the nearest populated page. */
export function formatSavestateListEmptyPage(
  total: number,
  offset: number | undefined,
  limit = 10,
  platform?: string,
): string {
  const start = offset ?? 0;
  const totalLabel = platform ? `Total matching platform "${platform}"` : 'Total stored';
  if (total === 0) {
    return `No snapshots found at offset ${start}. ${totalLabel}: 0`;
  }

  const suggestedOffset = Math.floor((total - 1) / limit) * limit;
  return `No snapshots found at offset ${start}. ${totalLabel}: ${total}. ` +
    `Suggested offset ${suggestedOffset} with limit ${limit} opens the nearest available page.`;
}
