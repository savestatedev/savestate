const MAX_SAVESTATE_STATUS_LIMIT = 1000;

/** Parse savestate_status limit without turning user input errors into an unbounded status dump. */
export function parseSavestateStatusLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SAVESTATE_STATUS_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SAVESTATE_STATUS_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N status field rows when savestate_status limit is set. */
export function selectSavestateStatusEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
