/** Normalize source identifiers at output boundaries without changing other metadata. */
export function normalizeMemorySource(source: string | undefined): string {
  const normalized = source?.trim().replace(/\s+/g, ' ') ?? '';
  return normalized || 'unknown';
}

/** Normalize namespace identifiers while preserving absent namespaces as absent. */
export function normalizeMemoryNamespace(namespace: string | undefined): string | undefined {
  const normalized = namespace?.trim() ?? '';
  return normalized || undefined;
}

/** Preserve metadata shape while normalizing explicitly stored routing identifiers. */
export function normalizeMemoryMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return metadata;

  const normalized = { ...metadata };
  if (typeof metadata.source === 'string') {
    normalized.source = normalizeMemorySource(metadata.source);
  }
  if (typeof metadata.namespace === 'string') {
    const namespace = normalizeMemoryNamespace(metadata.namespace);
    if (namespace === undefined) {
      delete normalized.namespace;
    } else {
      normalized.namespace = namespace;
    }
  }

  return normalized;
}
