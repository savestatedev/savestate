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

/** Explain an empty page without losing the caller's pagination position. */
export function formatSavestateListEmptyPage(total: number, offset: number | undefined): string {
  return `No snapshots found at offset ${offset ?? 0}. Total stored: ${total}`;
}
