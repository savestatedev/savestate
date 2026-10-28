/** Parse savestate_search_snapshots queries before doing any snapshot work. */
export function parseSearchSnapshotsQuery(value: string): string {
  const query = value.trim();
  if (query.length === 0) {
    throw new Error('Invalid query value. Expected a non-empty search query.');
  }
  return query;
}
