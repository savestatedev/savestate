import type { MemoryEntry } from '../memory/types.js';

/** Keep memory lifecycle timestamps available to MCP clients consuming the resource. */
export function toMemoryResourceEntry(memory: MemoryEntry): Pick<
  MemoryEntry,
  'id' | 'type' | 'content' | 'tags' | 'importance' | 'createdAt' | 'updatedAt' | 'expiresAt'
> {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    tags: memory.tags,
    importance: memory.importance,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    expiresAt: memory.expiresAt,
  };
}
