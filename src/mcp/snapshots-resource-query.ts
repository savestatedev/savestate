export type SnapshotsResourceQueryParameter =
  | 'limit'
  | 'offset'
  | 'platform'
  | 'adapter'
  | 'label'
  | 'tag'
  | 'since'
  | 'until';

/** Reject ambiguous single-valued queries instead of silently choosing one duplicate value. */
export function getSnapshotsResourceQueryValue(
  searchParams: URLSearchParams,
  name: SnapshotsResourceQueryParameter,
): string | null {
  const values = searchParams.getAll(name);
  if (values.length > 1) {
    throw new Error(`Duplicate ${name} query parameter. Provide only one value.`);
  }

  return values[0] ?? null;
}
