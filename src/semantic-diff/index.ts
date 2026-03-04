/**
 * Semantic Diff Module
 * 
 * Provides human-friendly diff output for agent identity and state changes.
 */

import { diffArrays } from './diff-utils.js';

/**
 * Agent identity schema
 */
export interface AgentIdentity {
  /** Agent name */
  name: string;
  
  /** Agent role/goals */
  goals?: string[];
  
  /** Tone/style preferences */
  tone?: string;
  
  /** Constraints/rules */
  constraints?: string[];
  
  /** Allowed tools */
  tools?: string[];
  
  /** System prompts */
  systemPrompts?: string[];
  
  /** Memory settings */
  memory?: {
    maxMemories?: number;
    importanceThreshold?: number;
    retentionDays?: number;
  };
  
  /** Custom fields */
  [key: string]: unknown;
}

/**
 * Types of semantic changes
 */
export enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
  UNCHANGED = 'unchanged',
}

/**
 * A semantic change entry
 */
export interface SemanticChange {
  type: ChangeType;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
}

/**
 * Diff result with semantic interpretation
 */
export interface SemanticDiffResult {
  hasChanges: boolean;
  changes: SemanticChange[];
  summary: string;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
}

/**
 * Deep comparison of two values
 */
function deepCompare(oldVal: unknown, newVal: unknown, path: string): SemanticChange[] {
  const changes: SemanticChange[] = [];
  
  // Handle undefined/null
  if (oldVal === undefined && newVal !== undefined) {
    changes.push({
      type: ChangeType.ADDED,
      path,
      newValue: newVal,
      description: `Added: ${formatValue(newVal)}`,
    });
    return changes;
  }
  
  if (oldVal !== undefined && newVal === undefined) {
    changes.push({
      type: ChangeType.REMOVED,
      path,
      oldValue: oldVal,
      description: `Removed: ${formatValue(oldVal)}`,
    });
    return changes;
  }
  
  // Handle arrays
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const arrayChanges = diffArrays(oldVal, newVal, path);
    return changes.concat(arrayChanges);
  }
  
  // Handle objects
  if (typeof oldVal === 'object' && typeof newVal === 'object' && 
      oldVal !== null && newVal !== null) {
    const allKeys = new Set([
      ...Object.keys(oldVal as object),
      ...Object.keys(newVal as object),
    ]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      const changesFromDeep = deepCompare(
        (oldVal as Record<string, unknown>)[key],
        (newVal as Record<string, unknown>)[key],
        newPath
      );
      changes.push(...changesFromDeep);
    }
    return changes;
  }
  
  // Primitive comparison
  if (oldVal !== newVal) {
    changes.push({
      type: ChangeType.MODIFIED,
      path,
      oldValue: oldVal,
      newValue: newVal,
      description: `Changed from "${oldVal}" to "${newVal}"`,
    });
  }
  
  return changes;
}

/**
 * Format a value for display
 */
function formatValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val.length > 50 ? `"${val.substring(0, 47)}..."` : `"${val}"`;
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return `{${Object.keys(val).length} keys}`;
  return String(val);
}

/**
 * Generate semantic diff between two identity objects
 */
export function diffIdentity(oldIdentity: AgentIdentity, newIdentity: AgentIdentity): SemanticDiffResult {
  const changes = deepCompare(oldIdentity, newIdentity, '');
  
  // Filter out unchanged
  const semanticChanges = changes.filter(c => c.type !== ChangeType.UNCHANGED);
  
  const addedCount = semanticChanges.filter(c => c.type === ChangeType.ADDED).length;
  const removedCount = semanticChanges.filter(c => c.type === ChangeType.REMOVED).length;
  const modifiedCount = semanticChanges.filter(c => c.type === ChangeType.MODIFIED).length;
  
  let summary = '';
  if (semanticChanges.length === 0) {
    summary = 'No changes detected';
  } else {
    const parts: string[] = [];
    if (addedCount > 0) parts.push(`+${addedCount} added`);
    if (removedCount > 0) parts.push(`-${removedCount} removed`);
    if (modifiedCount > 0) parts.push(`~${modifiedCount} modified`);
    summary = parts.join(', ');
  }
  
  return {
    hasChanges: semanticChanges.length > 0,
    changes: semanticChanges,
    summary,
    addedCount,
    removedCount,
    modifiedCount,
  };
}

/**
 * Generate semantic diff between two JSON objects (generic)
 */
export function diffObjects(oldObj: Record<string, unknown>, newObj: Record<string, unknown>): SemanticDiffResult {
  return diffIdentity(oldObj as unknown as AgentIdentity, newObj as unknown as AgentIdentity);
}

/**
 * Format diff result as human-readable string
 */
export function formatDiff(result: SemanticDiffResult): string {
  const lines: string[] = [];
  
  lines.push(`📋 Semantic Diff`);
  lines.push(`================`);
  lines.push(`Summary: ${result.summary}`);
  lines.push('');
  
  if (!result.hasChanges) {
    lines.push('No changes detected between the two versions.');
    return lines.join('\n');
  }
  
  // Group changes by type
  const added = result.changes.filter(c => c.type === ChangeType.ADDED);
  const removed = result.changes.filter(c => c.type === ChangeType.REMOVED);
  const modified = result.changes.filter(c => c.type === ChangeType.MODIFIED);
  
  if (added.length > 0) {
    lines.push('➕ Added:');
    for (const change of added) {
      lines.push(`  • ${change.path}: ${formatValue(change.newValue)}`);
    }
    lines.push('');
  }
  
  if (removed.length > 0) {
    lines.push('➖ Removed:');
    for (const change of removed) {
      lines.push(`  • ${change.path}: ${formatValue(change.oldValue)}`);
    }
    lines.push('');
  }
  
  if (modified.length > 0) {
    lines.push('✏️  Modified:');
    for (const change of modified) {
      lines.push(`  • ${change.path}:`);
      lines.push(`    - ${formatValue(change.oldValue)}`);
      lines.push(`    + ${formatValue(change.newValue)}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format diff as JSON
 */
export function formatDiffJSON(result: SemanticDiffResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Validate identity schema
 */
export function validateIdentity(identity: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!identity || typeof identity !== 'object') {
    errors.push('Identity must be an object');
    return { valid: false, errors };
  }
  
  const id = identity as Record<string, unknown>;
  
  if (!id.name || typeof id.name !== 'string') {
    errors.push('name is required and must be a string');
  }
  
  if (id.goals && !Array.isArray(id.goals)) {
    errors.push('goals must be an array');
  }
  
  if (id.constraints && !Array.isArray(id.constraints)) {
    errors.push('constraints must be an array');
  }
  
  if (id.tools && !Array.isArray(id.tools)) {
    errors.push('tools must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get identity schema as JSON Schema
 */
export function getIdentitySchema(): object {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'Agent name',
      },
      goals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Agent goals',
      },
      tone: {
        type: 'string',
        enum: ['formal', 'casual', 'technical', 'friendly'],
        description: 'Tone/style preferences',
      },
      constraints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Constraints/rules',
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Allowed tools',
      },
      systemPrompts: {
        type: 'array',
        items: { type: 'string' },
        description: 'System prompts',
      },
      memory: {
        type: 'object',
        properties: {
          maxMemories: { type: 'number' },
          importanceThreshold: { type: 'number' },
          retentionDays: { type: 'number' },
        },
      },
    },
  };
}

export default {
  diffIdentity,
  diffObjects,
  formatDiff,
  formatDiffJSON,
  validateIdentity,
  getIdentitySchema,
  ChangeType,
};
