/**
 * State Event Diff (Issue #92)
 *
 * Compares state events (memory entries, decisions, preferences)
 * between two snapshots and generates human-readable diffs.
 */

import type { Snapshot, MemoryEntry, ConversationIndex } from '../types.js';

/**
 * Types of state events tracked in diffs.
 */
export type StateEventType =
  | 'decision'
  | 'preference'
  | 'memory'
  | 'error'
  | 'api_response'
  | 'conversation'
  | 'knowledge';

/**
 * A single state event change.
 */
export interface StateEventChange {
  /** Type of state event */
  type: StateEventType;
  /** Change operation */
  operation: 'added' | 'removed' | 'modified';
  /** Unique identifier for the event */
  id: string;
  /** Human-readable description */
  description: string;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Timestamp of the event (if available) */
  timestamp?: string;
}

/**
 * Result of comparing state events between snapshots.
 */
export interface StateEventDiff {
  /** Whether there are any changes */
  hasChanges: boolean;
  /** Changes grouped by event type */
  byType: Map<StateEventType, StateEventChange[]>;
  /** Total counts by operation */
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
  /** Memory tier changes */
  memoryTierChanges?: {
    promoted: number;
    demoted: number;
    pinned: number;
    unpinned: number;
  };
}

/**
 * Compare state events between two snapshots.
 *
 * @param before - Previous snapshot state
 * @param after - Current snapshot state
 * @returns State event diff result
 */
export function diffStateEvents(
  before: Snapshot | undefined,
  after: Snapshot | undefined,
): StateEventDiff {
  const changes: StateEventChange[] = [];

  if (!before && !after) {
    return createEmptyDiff();
  }

  // Compare memory entries
  const memoryChanges = diffMemoryEntries(
    before?.memory.core || [],
    after?.memory.core || [],
  );
  changes.push(...memoryChanges.changes);

  // Compare conversations
  const conversationChanges = diffConversations(
    before?.conversations,
    after?.conversations,
  );
  changes.push(...conversationChanges);

  // Compare knowledge documents
  const knowledgeChanges = diffKnowledge(
    before?.memory.knowledge || [],
    after?.memory.knowledge || [],
  );
  changes.push(...knowledgeChanges);

  // Extract decisions and preferences from memory changes
  const { decisions, preferences, errors } = categorizeMemoryChanges(changes);

  // Group by type
  const byType = new Map<StateEventType, StateEventChange[]>();
  for (const change of changes) {
    if (!byType.has(change.type)) {
      byType.set(change.type, []);
    }
    byType.get(change.type)!.push(change);
  }

  return {
    hasChanges: changes.length > 0,
    byType,
    summary: {
      added: changes.filter((c) => c.operation === 'added').length,
      removed: changes.filter((c) => c.operation === 'removed').length,
      modified: changes.filter((c) => c.operation === 'modified').length,
    },
    memoryTierChanges: memoryChanges.tierChanges,
  };
}

/**
 * Compare memory entries between snapshots.
 */
function diffMemoryEntries(
  before: MemoryEntry[],
  after: MemoryEntry[],
): {
  changes: StateEventChange[];
  tierChanges: StateEventDiff['memoryTierChanges'];
} {
  const changes: StateEventChange[] = [];
  const tierChanges = {
    promoted: 0,
    demoted: 0,
    pinned: 0,
    unpinned: 0,
  };

  const beforeMap = new Map(before.map((m) => [m.id, m]));
  const afterMap = new Map(after.map((m) => [m.id, m]));

  // Find added memories
  for (const [id, memory] of afterMap) {
    if (!beforeMap.has(id)) {
      const eventType = inferEventType(memory);
      changes.push({
        type: eventType,
        operation: 'added',
        id,
        description: formatMemoryDescription(memory, 'added'),
        details: extractMemoryDetails(memory),
        timestamp: memory.createdAt,
      });
    }
  }

  // Find removed memories
  for (const [id, memory] of beforeMap) {
    if (!afterMap.has(id)) {
      const eventType = inferEventType(memory);
      changes.push({
        type: eventType,
        operation: 'removed',
        id,
        description: formatMemoryDescription(memory, 'removed'),
        details: extractMemoryDetails(memory),
        timestamp: memory.updatedAt || memory.createdAt,
      });
    }
  }

  // Find modified memories
  for (const [id, afterMemory] of afterMap) {
    const beforeMemory = beforeMap.get(id);
    if (beforeMemory) {
      // Check for content changes
      if (beforeMemory.content !== afterMemory.content) {
        const eventType = inferEventType(afterMemory);
        changes.push({
          type: eventType,
          operation: 'modified',
          id,
          description: formatMemoryDescription(afterMemory, 'modified'),
          details: {
            before: truncate(beforeMemory.content),
            after: truncate(afterMemory.content),
          },
          timestamp: afterMemory.updatedAt,
        });
      }

      // Track tier changes
      if (beforeMemory.tier && afterMemory.tier) {
        const tierOrder = { L1: 0, L2: 1, L3: 2 };
        const beforeOrder = tierOrder[beforeMemory.tier];
        const afterOrder = tierOrder[afterMemory.tier];
        if (afterOrder < beforeOrder) {
          tierChanges.promoted++;
        } else if (afterOrder > beforeOrder) {
          tierChanges.demoted++;
        }
      }

      // Track pin changes
      if (!beforeMemory.pinned && afterMemory.pinned) {
        tierChanges.pinned++;
      } else if (beforeMemory.pinned && !afterMemory.pinned) {
        tierChanges.unpinned++;
      }
    }
  }

  return { changes, tierChanges };
}

/**
 * Compare conversations between snapshots.
 */
function diffConversations(
  before: ConversationIndex | undefined,
  after: ConversationIndex | undefined,
): StateEventChange[] {
  const changes: StateEventChange[] = [];

  const beforeMap = new Map(
    (before?.conversations || []).map((c) => [c.id, c]),
  );
  const afterMap = new Map(
    (after?.conversations || []).map((c) => [c.id, c]),
  );

  // Find new conversations
  for (const [id, conv] of afterMap) {
    if (!beforeMap.has(id)) {
      changes.push({
        type: 'conversation',
        operation: 'added',
        id,
        description: `New conversation: "${conv.title || 'Untitled'}" (${conv.messageCount} messages)`,
        details: {
          title: conv.title,
          messageCount: conv.messageCount,
        },
        timestamp: conv.createdAt,
      });
    }
  }

  // Find removed conversations
  for (const [id, conv] of beforeMap) {
    if (!afterMap.has(id)) {
      changes.push({
        type: 'conversation',
        operation: 'removed',
        id,
        description: `Removed conversation: "${conv.title || 'Untitled'}"`,
        details: {
          title: conv.title,
          messageCount: conv.messageCount,
        },
        timestamp: conv.updatedAt,
      });
    }
  }

  // Find conversations with new messages
  for (const [id, afterConv] of afterMap) {
    const beforeConv = beforeMap.get(id);
    if (beforeConv && afterConv.messageCount > beforeConv.messageCount) {
      const newMessages = afterConv.messageCount - beforeConv.messageCount;
      changes.push({
        type: 'conversation',
        operation: 'modified',
        id,
        description: `${newMessages} new message${newMessages > 1 ? 's' : ''} in "${afterConv.title || 'Untitled'}"`,
        details: {
          title: afterConv.title,
          beforeCount: beforeConv.messageCount,
          afterCount: afterConv.messageCount,
          newMessages,
        },
        timestamp: afterConv.updatedAt,
      });
    }
  }

  return changes;
}

/**
 * Compare knowledge documents between snapshots.
 */
function diffKnowledge(
  before: { id: string; filename: string }[],
  after: { id: string; filename: string }[],
): StateEventChange[] {
  const changes: StateEventChange[] = [];

  const beforeMap = new Map(before.map((k) => [k.id, k]));
  const afterMap = new Map(after.map((k) => [k.id, k]));

  // Find added knowledge
  for (const [id, doc] of afterMap) {
    if (!beforeMap.has(id)) {
      changes.push({
        type: 'knowledge',
        operation: 'added',
        id,
        description: `Added knowledge document: "${doc.filename}"`,
        details: { filename: doc.filename },
      });
    }
  }

  // Find removed knowledge
  for (const [id, doc] of beforeMap) {
    if (!afterMap.has(id)) {
      changes.push({
        type: 'knowledge',
        operation: 'removed',
        id,
        description: `Removed knowledge document: "${doc.filename}"`,
        details: { filename: doc.filename },
      });
    }
  }

  return changes;
}

/**
 * Infer the event type from a memory entry.
 */
function inferEventType(memory: MemoryEntry): StateEventType {
  const content = memory.content.toLowerCase();
  const source = (memory.source || '').toLowerCase();

  // Check for decisions (choices, selections, configurations)
  if (
    content.includes('decided') ||
    content.includes('chose') ||
    content.includes('selected') ||
    content.includes('configured') ||
    content.includes('set to') ||
    source.includes('decision')
  ) {
    return 'decision';
  }

  // Check for preferences
  if (
    content.includes('prefer') ||
    content.includes('like') ||
    content.includes('favorite') ||
    content.includes('default') ||
    source.includes('preference')
  ) {
    return 'preference';
  }

  // Check for errors
  if (
    content.includes('error') ||
    content.includes('failed') ||
    content.includes('exception') ||
    source.includes('error')
  ) {
    return 'error';
  }

  // Check for API responses
  if (
    source.includes('api') ||
    source.includes('tool_output') ||
    content.includes('response from')
  ) {
    return 'api_response';
  }

  return 'memory';
}

/**
 * Format a memory description for display.
 */
function formatMemoryDescription(
  memory: MemoryEntry,
  operation: 'added' | 'removed' | 'modified',
): string {
  const content = truncate(memory.content, 60);
  const source = memory.source ? ` (from ${memory.source})` : '';

  switch (operation) {
    case 'added':
      return `+ ${content}${source}`;
    case 'removed':
      return `- ${content}${source}`;
    case 'modified':
      return `~ ${content}${source}`;
  }
}

/**
 * Extract relevant details from a memory entry.
 */
function extractMemoryDetails(memory: MemoryEntry): Record<string, unknown> {
  return {
    content: memory.content,
    source: memory.source,
    tier: memory.tier,
    pinned: memory.pinned,
    metadata: memory.metadata,
  };
}

/**
 * Categorize memory changes into decisions, preferences, and errors.
 */
function categorizeMemoryChanges(changes: StateEventChange[]): {
  decisions: StateEventChange[];
  preferences: StateEventChange[];
  errors: StateEventChange[];
} {
  return {
    decisions: changes.filter((c) => c.type === 'decision'),
    preferences: changes.filter((c) => c.type === 'preference'),
    errors: changes.filter((c) => c.type === 'error'),
  };
}

/**
 * Create an empty diff result.
 */
function createEmptyDiff(): StateEventDiff {
  return {
    hasChanges: false,
    byType: new Map(),
    summary: { added: 0, removed: 0, modified: 0 },
  };
}

/**
 * Truncate a string for display.
 */
function truncate(str: string, maxLength = 50): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format state event diff for human-readable output.
 *
 * @param diff - The state event diff to format
 * @returns Formatted string output
 */
export function formatStateEventDiff(diff: StateEventDiff): string {
  if (!diff.hasChanges) {
    return 'No state changes.';
  }

  const lines: string[] = [];
  lines.push('State Changes:');

  // Display by type in a specific order
  const typeOrder: StateEventType[] = [
    'decision',
    'preference',
    'error',
    'api_response',
    'memory',
    'conversation',
    'knowledge',
  ];

  const typeLabels: Record<StateEventType, string> = {
    decision: 'Decisions',
    preference: 'Preferences',
    error: 'Errors',
    api_response: 'API Responses',
    memory: 'Memories',
    conversation: 'Conversations',
    knowledge: 'Knowledge',
  };

  for (const type of typeOrder) {
    const changes = diff.byType.get(type);
    if (!changes || changes.length === 0) continue;

    const added = changes.filter((c) => c.operation === 'added').length;
    const removed = changes.filter((c) => c.operation === 'removed').length;
    const modified = changes.filter((c) => c.operation === 'modified').length;

    const counts: string[] = [];
    if (added > 0) counts.push(`${added} new`);
    if (removed > 0) counts.push(`${removed} removed`);
    if (modified > 0) counts.push(`${modified} modified`);

    lines.push(`  ${typeLabels[type]} (${counts.join(', ')}):`);

    // Show up to 5 examples per type
    const examples = changes.slice(0, 5);
    for (const change of examples) {
      lines.push(`    ${change.description}`);
    }

    if (changes.length > 5) {
      lines.push(`    ... and ${changes.length - 5} more`);
    }
  }

  // Show memory tier changes if any
  if (diff.memoryTierChanges) {
    const tc = diff.memoryTierChanges;
    const tierChanges: string[] = [];
    if (tc.promoted > 0) tierChanges.push(`${tc.promoted} promoted`);
    if (tc.demoted > 0) tierChanges.push(`${tc.demoted} demoted`);
    if (tc.pinned > 0) tierChanges.push(`${tc.pinned} pinned`);
    if (tc.unpinned > 0) tierChanges.push(`${tc.unpinned} unpinned`);

    if (tierChanges.length > 0) {
      lines.push('');
      lines.push(`  Memory Tiers: ${tierChanges.join(', ')}`);
    }
  }

  lines.push('');
  lines.push(
    `Summary: +${diff.summary.added} added, -${diff.summary.removed} removed, ~${diff.summary.modified} modified`,
  );

  return lines.join('\n');
}
