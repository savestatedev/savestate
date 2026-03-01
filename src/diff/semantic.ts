/**
 * Semantic Diff Engine (Issue #92)
 *
 * Generates human-readable diffs for agent identity changes.
 * Handles nested objects and produces stable output regardless of key ordering.
 */

import type { AgentIdentity, ToolReference } from '../identity/schema.js';
import { CORE_IDENTITY_FIELDS } from '../identity/schema.js';

/**
 * Types of changes in a semantic diff.
 */
export type ChangeType = 'added' | 'removed' | 'modified';

/**
 * A single semantic change in the diff.
 */
export interface SemanticChange {
  /** Type of change */
  type: ChangeType;
  /** Field path (e.g., "goals", "tools.0.name") */
  path: string;
  /** Human-readable field name */
  field: string;
  /** Previous value (for removed/modified) */
  before?: unknown;
  /** New value (for added/modified) */
  after?: unknown;
  /** Human-readable description of the change */
  description: string;
}

/**
 * Result of comparing two identity documents.
 */
export interface IdentityDiff {
  /** Whether there are any changes */
  hasChanges: boolean;
  /** List of semantic changes */
  changes: SemanticChange[];
  /** Summary counts */
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
  /** Version change (if any) */
  versionChange?: {
    before: string;
    after: string;
  };
}

/**
 * Compare two agent identity documents and generate a semantic diff.
 *
 * @param before - Previous identity state
 * @param after - Current identity state
 * @returns Semantic diff result
 */
export function diffIdentity(
  before: AgentIdentity | undefined,
  after: AgentIdentity | undefined,
): IdentityDiff {
  const changes: SemanticChange[] = [];

  // Handle edge cases
  if (!before && !after) {
    return createEmptyDiff();
  }

  if (!before && after) {
    // Everything is new
    return createNewIdentityDiff(after);
  }

  if (before && !after) {
    // Everything was removed
    return createRemovedIdentityDiff(before);
  }

  // Both exist - compare field by field
  const b = before!;
  const a = after!;

  // Compare version
  let versionChange: IdentityDiff['versionChange'];
  if (b.version !== a.version) {
    versionChange = { before: b.version, after: a.version };
  }

  // Compare scalar fields
  compareScalarField(changes, 'name', b.name, a.name);
  compareScalarField(changes, 'tone', b.tone, a.tone);
  compareScalarField(changes, 'persona', b.persona, a.persona);
  compareScalarField(changes, 'instructions', b.instructions, a.instructions);

  // Compare array fields
  compareStringArray(changes, 'goals', b.goals || [], a.goals || []);
  compareStringArray(changes, 'constraints', b.constraints || [], a.constraints || []);

  // Compare tools (complex objects)
  compareTools(changes, b.tools || [], a.tools || []);

  // Compare metadata (extensible object)
  compareMetadata(changes, b.metadata || {}, a.metadata || {});

  return {
    hasChanges: changes.length > 0 || !!versionChange,
    changes,
    summary: computeSummary(changes),
    versionChange,
  };
}

/**
 * Compare a scalar field.
 */
function compareScalarField(
  changes: SemanticChange[],
  field: string,
  before: string | undefined,
  after: string | undefined,
): void {
  if (before === after) {
    return;
  }

  if (before === undefined && after !== undefined) {
    changes.push({
      type: 'added',
      path: field,
      field: humanizeFieldName(field),
      after,
      description: `Added ${humanizeFieldName(field)}: "${truncate(String(after))}"`,
    });
  } else if (before !== undefined && after === undefined) {
    changes.push({
      type: 'removed',
      path: field,
      field: humanizeFieldName(field),
      before,
      description: `Removed ${humanizeFieldName(field)}: "${truncate(String(before))}"`,
    });
  } else {
    changes.push({
      type: 'modified',
      path: field,
      field: humanizeFieldName(field),
      before,
      after,
      description: `Changed ${humanizeFieldName(field)}: "${truncate(String(before))}" → "${truncate(String(after))}"`,
    });
  }
}

/**
 * Compare string arrays (goals, constraints).
 */
function compareStringArray(
  changes: SemanticChange[],
  field: string,
  before: string[],
  after: string[],
): void {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  // Find added items
  for (const item of after) {
    if (!beforeSet.has(item)) {
      changes.push({
        type: 'added',
        path: field,
        field: humanizeFieldName(field),
        after: item,
        description: `+ ${humanizeFieldName(field)}: "${truncate(item)}"`,
      });
    }
  }

  // Find removed items
  for (const item of before) {
    if (!afterSet.has(item)) {
      changes.push({
        type: 'removed',
        path: field,
        field: humanizeFieldName(field),
        before: item,
        description: `- ${humanizeFieldName(field)}: "${truncate(item)}"`,
      });
    }
  }
}

/**
 * Compare tool arrays.
 */
function compareTools(
  changes: SemanticChange[],
  before: ToolReference[],
  after: ToolReference[],
): void {
  const beforeMap = new Map(before.map((t) => [t.name, t]));
  const afterMap = new Map(after.map((t) => [t.name, t]));

  // Find added tools
  for (const [name, tool] of afterMap) {
    if (!beforeMap.has(name)) {
      changes.push({
        type: 'added',
        path: `tools.${name}`,
        field: 'tools',
        after: tool,
        description: `+ tool: "${name}"${tool.description ? ` (${truncate(tool.description)})` : ''}`,
      });
    }
  }

  // Find removed tools
  for (const [name, tool] of beforeMap) {
    if (!afterMap.has(name)) {
      changes.push({
        type: 'removed',
        path: `tools.${name}`,
        field: 'tools',
        before: tool,
        description: `- tool: "${name}"`,
      });
    }
  }

  // Find modified tools
  for (const [name, afterTool] of afterMap) {
    const beforeTool = beforeMap.get(name);
    if (beforeTool) {
      const toolChanges: string[] = [];

      if (beforeTool.enabled !== afterTool.enabled) {
        toolChanges.push(
          afterTool.enabled ? 'enabled' : 'disabled',
        );
      }

      if (beforeTool.description !== afterTool.description) {
        toolChanges.push('description changed');
      }

      if (JSON.stringify(beforeTool.config) !== JSON.stringify(afterTool.config)) {
        toolChanges.push('config changed');
      }

      if (toolChanges.length > 0) {
        changes.push({
          type: 'modified',
          path: `tools.${name}`,
          field: 'tools',
          before: beforeTool,
          after: afterTool,
          description: `~ tool "${name}": ${toolChanges.join(', ')}`,
        });
      }
    }
  }
}

/**
 * Compare metadata objects.
 */
function compareMetadata(
  changes: SemanticChange[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): void {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of Array.from(allKeys).sort()) {
    const beforeVal = before[key];
    const afterVal = after[key];

    if (beforeVal === undefined && afterVal !== undefined) {
      changes.push({
        type: 'added',
        path: `metadata.${key}`,
        field: `metadata.${key}`,
        after: afterVal,
        description: `+ metadata.${key}: ${formatValue(afterVal)}`,
      });
    } else if (beforeVal !== undefined && afterVal === undefined) {
      changes.push({
        type: 'removed',
        path: `metadata.${key}`,
        field: `metadata.${key}`,
        before: beforeVal,
        description: `- metadata.${key}`,
      });
    } else if (!deepEqual(beforeVal, afterVal)) {
      changes.push({
        type: 'modified',
        path: `metadata.${key}`,
        field: `metadata.${key}`,
        before: beforeVal,
        after: afterVal,
        description: `~ metadata.${key}: ${formatValue(beforeVal)} → ${formatValue(afterVal)}`,
      });
    }
  }
}

/**
 * Create an empty diff result.
 */
function createEmptyDiff(): IdentityDiff {
  return {
    hasChanges: false,
    changes: [],
    summary: { added: 0, removed: 0, modified: 0 },
  };
}

/**
 * Create a diff for a newly created identity.
 */
function createNewIdentityDiff(identity: AgentIdentity): IdentityDiff {
  const changes: SemanticChange[] = [];

  if (identity.name) {
    changes.push({
      type: 'added',
      path: 'name',
      field: 'name',
      after: identity.name,
      description: `+ name: "${identity.name}"`,
    });
  }

  if (identity.tone) {
    changes.push({
      type: 'added',
      path: 'tone',
      field: 'tone',
      after: identity.tone,
      description: `+ tone: "${identity.tone}"`,
    });
  }

  for (const goal of identity.goals || []) {
    changes.push({
      type: 'added',
      path: 'goals',
      field: 'goals',
      after: goal,
      description: `+ goals: "${truncate(goal)}"`,
    });
  }

  for (const constraint of identity.constraints || []) {
    changes.push({
      type: 'added',
      path: 'constraints',
      field: 'constraints',
      after: constraint,
      description: `+ constraints: "${truncate(constraint)}"`,
    });
  }

  for (const tool of identity.tools || []) {
    changes.push({
      type: 'added',
      path: `tools.${tool.name}`,
      field: 'tools',
      after: tool,
      description: `+ tool: "${tool.name}"`,
    });
  }

  if (identity.persona) {
    changes.push({
      type: 'added',
      path: 'persona',
      field: 'persona',
      after: identity.persona,
      description: `+ persona: "${truncate(identity.persona)}"`,
    });
  }

  if (identity.instructions) {
    changes.push({
      type: 'added',
      path: 'instructions',
      field: 'instructions',
      after: identity.instructions,
      description: `+ instructions: "${truncate(identity.instructions)}"`,
    });
  }

  return {
    hasChanges: true,
    changes,
    summary: computeSummary(changes),
    versionChange: { before: '', after: identity.version },
  };
}

/**
 * Create a diff for a completely removed identity.
 */
function createRemovedIdentityDiff(identity: AgentIdentity): IdentityDiff {
  const changes: SemanticChange[] = [];

  changes.push({
    type: 'removed',
    path: 'identity',
    field: 'identity',
    before: identity,
    description: `- entire identity document removed`,
  });

  return {
    hasChanges: true,
    changes,
    summary: { added: 0, removed: 1, modified: 0 },
    versionChange: { before: identity.version, after: '' },
  };
}

/**
 * Compute summary counts from changes.
 */
function computeSummary(changes: SemanticChange[]): IdentityDiff['summary'] {
  return {
    added: changes.filter((c) => c.type === 'added').length,
    removed: changes.filter((c) => c.type === 'removed').length,
    modified: changes.filter((c) => c.type === 'modified').length,
  };
}

/**
 * Humanize a field name for display.
 */
function humanizeFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
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
 * Format a value for display.
 */
function formatValue(val: unknown): string {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${truncate(val)}"`;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return `{${Object.keys(val).length} keys}`;
  return String(val);
}

/**
 * Deep equality check.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;

  // Sort keys for consistent comparison
  const aStr = JSON.stringify(a, Object.keys(a as object).sort());
  const bStr = JSON.stringify(b, Object.keys(b as object).sort());
  return aStr === bStr;
}

/**
 * Format an identity diff for human-readable output.
 *
 * @param diff - The diff result to format
 * @returns Formatted string output
 */
export function formatIdentityDiff(diff: IdentityDiff): string {
  if (!diff.hasChanges) {
    return 'No changes to agent identity.';
  }

  const lines: string[] = [];
  lines.push('Agent Identity Changes:');

  if (diff.versionChange) {
    lines.push(
      `  Version: ${diff.versionChange.before || '(none)'} → ${diff.versionChange.after || '(none)'}`,
    );
  }

  // Group changes by field
  const byField = new Map<string, SemanticChange[]>();
  for (const change of diff.changes) {
    const field = change.field;
    if (!byField.has(field)) {
      byField.set(field, []);
    }
    byField.get(field)!.push(change);
  }

  // Sort fields for stable output
  const sortedFields = Array.from(byField.keys()).sort((a, b) => {
    // Core fields first, then alphabetically
    const aCore = CORE_IDENTITY_FIELDS.indexOf(a as any);
    const bCore = CORE_IDENTITY_FIELDS.indexOf(b as any);
    if (aCore >= 0 && bCore >= 0) return aCore - bCore;
    if (aCore >= 0) return -1;
    if (bCore >= 0) return 1;
    return a.localeCompare(b);
  });

  for (const field of sortedFields) {
    const fieldChanges = byField.get(field)!;
    for (const change of fieldChanges) {
      const symbol = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
      lines.push(`  ${symbol} ${change.description.replace(/^[+\-~]\s*/, '')}`);
    }
  }

  lines.push('');
  lines.push(
    `Summary: +${diff.summary.added} added, -${diff.summary.removed} removed, ~${diff.summary.modified} modified`,
  );

  return lines.join('\n');
}
