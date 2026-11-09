export type SnapshotsResourcePaginationParameter = 'limit' | 'offset';

/** Reject ambiguous pagination queries instead of silently choosing one duplicate value. */
export function getSnapshotsResourcePaginationQueryValue(
  searchParams: URLSearchParams,
  name: SnapshotsResourcePaginationParameter,
): string | null {
  const values = searchParams.getAll(name);
  if (values.length > 1) {
    throw new Error(`Duplicate ${name} query parameter. Provide only one value.`);
  }

  return values[0] ?? null;
}
