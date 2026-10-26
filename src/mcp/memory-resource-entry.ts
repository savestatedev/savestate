import type { MemoryEntry } from '../memory/types.js';
import { normalizeMemoryMetadata } from '../memory/source.js';

/** Keep memory lifecycle timestamps available to MCP clients consuming the resource. */
export function toMemoryResourceEntry(memory: MemoryEntry): Pick<
  MemoryEntry,
  'id' | 'type' | 'content' | 'metadata' | 'tags' | 'importance' | 'createdAt' | 'updatedAt' | 'expiresAt'
> {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    metadata: normalizeMemoryMetadata(memory.metadata),
    tags: memory.tags,
    importance: memory.importance,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    expiresAt: memory.expiresAt,
  };
}
