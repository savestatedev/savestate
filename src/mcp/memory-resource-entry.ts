import type { MemoryEntry } from '../memory/types.js';
import { normalizeMemoryMetadata, normalizeMemorySource } from '../memory/source.js';

function normalizeMemoryNamespace(metadata: Record<string, unknown> | undefined): string | null {
  if (typeof metadata?.namespace !== 'string') return null;
  const namespace = metadata.namespace.trim().replace(/\s+/g, ' ');
  return namespace || null;
}

/** Keep memory lifecycle timestamps available to MCP clients consuming the resource. */
export function toMemoryResourceEntry(memory: MemoryEntry): Pick<
  MemoryEntry,
  'id' | 'type' | 'content' | 'metadata' | 'tags' | 'importance' | 'createdAt' | 'updatedAt' | 'expiresAt'
> & { source: string; namespace: string | null } {
  const metadata = normalizeMemoryMetadata(memory.metadata);
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    metadata,
    source: normalizeMemorySource(typeof metadata?.source === 'string' ? metadata.source : undefined),
    namespace: normalizeMemoryNamespace(metadata),
    tags: memory.tags,
    importance: memory.importance,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    expiresAt: memory.expiresAt,
  };
}
