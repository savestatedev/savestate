import type { MemoryEntry } from '../memory/types.js';

/** Render the metadata and lifecycle fields promised by list_memories. */
export function formatMemoryListEntry(memory: MemoryEntry): string[] {
  const preview = memory.content.length > 80
    ? memory.content.slice(0, 80) + '...'
    : memory.content;

  const lines = [
    `- [${memory.type}] ${memory.id}`,
    `  ${preview}`,
    `  Importance: ${memory.importance}`,
    `  Metadata: ${JSON.stringify(memory.metadata ?? {})}`,
    `  Created: ${memory.createdAt}`,
    `  Updated: ${memory.updatedAt}`,
    `  Expires: ${memory.expiresAt ?? 'none'}`,
    '',
  ];

  if (memory.tags && memory.tags.length > 0) {
    lines.splice(2, 0, `  Tags: ${memory.tags.join(', ')}`);
  }

  return lines;
}
