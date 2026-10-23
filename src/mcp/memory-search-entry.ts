import type { MemoryEntry } from '../memory/types.js';

/** Render the searchable memory fields promised by the MCP tool description. */
export function formatMemorySearchEntry(memory: MemoryEntry): string[] {
  const preview = memory.content.length > 100
    ? memory.content.slice(0, 100) + '...'
    : memory.content;

  return [
    `- ${memory.id}`,
    `  Type: ${memory.type}`,
    `  Tags: ${memory.tags?.join(', ') ?? 'none'}`,
    `  Importance: ${memory.importance}`,
    `  Metadata: ${JSON.stringify(memory.metadata ?? {})}`,
    `  Content: ${preview}`,
    '',
  ];
}
