const MAX_MEMORIES_RESOURCE_OFFSET = 1000;

const invalidOffsetMessage = (value: string): string =>
  `Invalid offset value "${value}". Expected a non-negative decimal integer up to ${MAX_MEMORIES_RESOURCE_OFFSET}.`;

/** Parse savestate://memories offset without turning user input errors into an unbounded skip. */
export function parseMemoriesResourceOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_MEMORIES_RESOURCE_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_MEMORIES_RESOURCE_OFFSET}.`,
    );
  }
  return value;
}

/** Parse the query-string form without accepting JavaScript-only numeric syntax or blanks. */
export function parseMemoriesResourceOffsetQuery(value: string): number {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(invalidOffsetMessage(value));
  }

  try {
    const offset = parseMemoriesResourceOffset(Number(normalized));
    if (offset === undefined) {
      throw new Error(invalidOffsetMessage(value));
    }
    return offset;
  } catch {
    throw new Error(invalidOffsetMessage(value));
  }
}

/** Skip the first N memories when savestate://memories offset is set. */
export function selectMemoriesResourceOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
