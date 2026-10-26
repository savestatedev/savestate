/** Normalize source identifiers at output boundaries without changing other metadata. */
export function normalizeMemorySource(source: string | undefined): string {
  const normalized = source?.trim() ?? '';
  return normalized || 'unknown';
}

/** Preserve metadata shape while normalizing an explicitly stored source identifier. */
export function normalizeMemoryMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (metadata === undefined || typeof metadata.source !== 'string') return metadata;
  return { ...metadata, source: normalizeMemorySource(metadata.source) };
}
