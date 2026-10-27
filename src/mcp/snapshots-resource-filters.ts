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

/** Parse an optional snapshot resource label filter without widening blank input. */
export function parseSnapshotsResourceLabel(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid label value. Expected a non-empty label.');
  }

  return normalized;
}

/** Normalize legacy snapshot labels before matching or exposing them to clients. */
export function normalizeSnapshotsResourceLabel(label: string | null | undefined): string | null {
  const normalized = label?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

/** Match snapshot labels case-insensitively while treating missing labels as non-matches. */
export function matchesSnapshotsResourceLabel(
  entryLabel: string | null | undefined,
  requestedLabel: string,
): boolean {
  const normalizedEntryLabel = normalizeSnapshotsResourceLabel(entryLabel);
  return normalizedEntryLabel !== null &&
    normalizedEntryLabel.toLowerCase() === requestedLabel.trim().toLowerCase();
}

/** Parse an optional snapshot resource tag filter without widening blank input. */
export function parseSnapshotsResourceTag(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid tag value. Expected a non-empty tag.');
  }

  return normalized.toLowerCase();
}

/** Normalize legacy snapshot tags before matching or exposing them to clients. */
export function normalizeSnapshotsResourceTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => {
      if (tag.length === 0) return false;
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

/** Match snapshot tags case-insensitively while treating missing tags as non-matches. */
export function matchesSnapshotsResourceTag(
  entryTags: string[] | null | undefined,
  requestedTag: string,
): boolean {
  const normalizedRequestedTag = requestedTag.trim().toLowerCase();
  return normalizeSnapshotsResourceTags(entryTags)
    .some((tag) => tag.toLowerCase() === normalizedRequestedTag);
}

/** Preserve active snapshot filters in resource pagination links. */
export function buildSnapshotsResourceUri(
  platform?: string,
  adapter?: string,
  label?: string,
  tag?: string,
): string {
  const filters = [
    platform === undefined ? null : `platform=${encodeURIComponent(platform)}`,
    adapter === undefined ? null : `adapter=${encodeURIComponent(adapter)}`,
    label === undefined ? null : `label=${encodeURIComponent(label)}`,
    tag === undefined ? null : `tag=${encodeURIComponent(tag)}`,
  ].filter((filter): filter is string => filter !== null);
  return filters.length > 0
    ? `savestate://snapshots?${filters.join('&')}`
    : 'savestate://snapshots';
}

/** Echo the active snapshot resource filter so clients can verify the applied scope. */
export function formatSnapshotsResourceFilters(
  platform?: string,
  adapter?: string,
  label?: string,
  tag?: string,
): {
  platform: string | null;
  adapter: string | null;
  label: string | null;
  tag: string | null;
} {
  return {
    platform: platform ?? null,
    adapter: adapter ?? null,
    label: label ?? null,
    tag: tag ?? null,
  };
}
