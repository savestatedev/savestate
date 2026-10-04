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
