const MAX_SAVESTATE_RESTORE_LIMIT = 1000;

/** Parse savestate_restore limit without turning user input errors into an unbounded restore dump. */
export function parseSavestateRestoreLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SAVESTATE_RESTORE_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SAVESTATE_RESTORE_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N status field rows when savestate_restore limit is set. */
export function selectSavestateRestoreEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
