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
  return entryPlatform.toLowerCase() === requestedPlatform.toLowerCase();
}

/** Preserve the active platform filter in snapshot resource pagination links. */
export function buildSnapshotsResourceUri(platform?: string): string {
  if (platform === undefined) return 'savestate://snapshots';
  return `savestate://snapshots?platform=${encodeURIComponent(platform)}`;
}

/** Echo the active snapshot resource filter so clients can verify the applied scope. */
export function formatSnapshotsResourceFilters(platform?: string): {
  platform: string | null;
} {
  return {
    platform: platform ?? null,
  };
}
