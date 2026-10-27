/** Parse an optional snapshot resource platform filter without widening blank input. */
export function parseSnapshotsResourcePlatform(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid platform value. Expected a non-empty platform.');
  }

  return normalized;
}

/** Match platform identifiers case-insensitively, like the savestate_list command. */
export function matchesSnapshotsResourcePlatform(
  entryPlatform: string,
  requestedPlatform: string,
): boolean {
  return entryPlatform.trim().toLowerCase() === requestedPlatform.trim().toLowerCase();
}

/** Parse an optional snapshot resource adapter filter without widening blank input. */
export function parseSnapshotsResourceAdapter(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid adapter value. Expected a non-empty adapter.');
  }

  return normalized;
}

/** Match adapter identifiers case-insensitively across legacy index entries. */
export function matchesSnapshotsResourceAdapter(
  entryAdapter: string,
  requestedAdapter: string,
): boolean {
  return entryAdapter.trim().toLowerCase() === requestedAdapter.trim().toLowerCase();
}

/** Preserve active snapshot filters in resource pagination links. */
export function buildSnapshotsResourceUri(platform?: string, adapter?: string): string {
  const filters = [
    platform === undefined ? null : `platform=${encodeURIComponent(platform)}`,
    adapter === undefined ? null : `adapter=${encodeURIComponent(adapter)}`,
  ].filter((filter): filter is string => filter !== null);
  return filters.length > 0
    ? `savestate://snapshots?${filters.join('&')}`
    : 'savestate://snapshots';
}

/** Echo the active snapshot resource filter so clients can verify the applied scope. */
export function formatSnapshotsResourceFilters(platform?: string, adapter?: string): {
  platform: string | null;
  adapter: string | null;
} {
  return {
    platform: platform ?? null,
    adapter: adapter ?? null,
  };
}
