/**
 * Identity Schema and Semantic Diff for Agent State
 * 
 * Provides a canonical identity document schema and semantic diff output.
 */

import type { Identity } from '../types.js';

/**
 * Canonical Agent Identity Schema
 * 
 * A stable, structured representation of an agent's identity
 * that can be stored in SAF archives or separately.
 */
export interface AgentIdentity {
  /** Identity document version */
  version: string;
  /** Unique identity identifier */
  id: string;
  /** Agent name */
  name: string;
  /** Agent goals and objectives */
  goals: string[];
  /** Tone and communication style */
  tone?: ToneConfig;
  /** Constraints and rules */
  constraints: Constraint[];
  /** Tools and capabilities */
  capabilities: Capability[];
  /** Memory settings */
  memory?: MemoryConfig;
  /** Custom configuration */
  config?: Record<string, unknown>;
  /** Metadata */
  metadata: IdentityMetadata;
}

/**
 * Tone configuration
 */
export interface ToneConfig {
  /** Communication style */
  style: 'formal' | 'casual' | 'technical' | 'friendly';
  /** Detail level */
  verbosity: 'brief' | 'moderate' | 'detailed';
  /** Include humor */
  humor?: boolean;
  /** Custom tone notes */
  notes?: string;
}

/**
 * Constraint definition
 */
export interface Constraint {
  /** Constraint type */
  type: 'policy' | 'safety' | 'user' | 'system' | 'custom';
  /** Constraint description */
  description: string;
  /** Priority (1 = highest) */
  priority?: number;
  /** Whether this is active */
  enabled: boolean;
}

/**
 * Capability definition
 */
export interface Capability {
  /** Capability name */
  name: string;
  /** Capability type */
  type: 'tool' | 'skill' | 'api' | 'integration';
  /** Whether enabled */
  enabled: boolean;
  /** Configuration */
  config?: Record<string, unknown>;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  /** Maximum memory entries */
  maxEntries?: number;
  /** Retention period */
  retention?: 'session' | '24h' | '7d' | '30d' | 'forever';
  /** Enable auto-summarization */
  autoSummarize?: boolean;
}

/**
 * Identity metadata
 */
export interface IdentityMetadata {
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt?: string;
  /** Author */
  author?: string;
  /** Tags */
  tags?: string[];
}

/**
 * Semantic difference between two identity documents
 */
export interface SemanticDiff {
  /** Identity ID */
  identityId: string;
  /** Previous version */
  from: string;
  /** New version */
  to: string;
  /** Changes */
  changes: DiffChange[];
  /** Summary */
  summary: DiffSummary;
  /** Timestamp */
  timestamp: string;
}

/**
 * A single change
 */
export interface DiffChange {
  /** Change type */
  type: 'added' | 'removed' | 'modified' | 'moved';
  /** Path to the changed element */
  path: string;
  /** Previous value (for modify/remove) */
  oldValue?: unknown;
  /** New value (for add/modify) */
  newValue?: unknown;
  /** Human-readable description */
  description: string;
}

/**
 * Summary of changes
 */
export interface DiffSummary {
  /** Total number of changes */
  totalChanges: number;
  /** Number of additions */
  additions: number;
  /** Number of removals */
  removals: number;
  /** Number of modifications */
  modifications: number;
  /** Breaking changes detected */
  breakingChanges: string[];
}

/**
 * Create an identity document from an Identity (SaveState types)
 */
export function fromIdentity(identity: Identity, name: string = 'Agent'): AgentIdentity {
  const now = new Date().toISOString();
  
  const goals = extractGoals(identity.personality);
  const constraints = extractConstraints(identity);
  const capabilities = extractCapabilities(identity);
  
  return {
    version: '1.0.0',
    id: generateId(),
    name,
    goals,
    tone: inferTone(identity.personality),
    constraints,
    capabilities,
    memory: identity.config?.memory as MemoryConfig | undefined,
    config: identity.config,
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * Extract goals from personality/system prompt
 */
function extractGoals(personality?: string): string[] {
  if (!personality) return [];
  
  // Simple extraction - look for goal-like statements
  const goalPatterns = [
    /you are designed to (.+?)\./i,
    /your goal is (.+?)\./i,
    /you help (.+?)\./i,
    /your purpose (.+?)\./i,
  ];
  
  const goals: string[] = [];
  for (const pattern of goalPatterns) {
    const match = personality.match(pattern);
    if (match) {
      goals.push(match[1]);
    }
  }
  
  return goals;
}

/**
 * Extract constraints from identity
 */
function extractConstraints(identity: Identity): Constraint[] {
  const constraints: Constraint[] = [];
  
  // Extract from config
  if (identity.config) {
    if (identity.config.maxTokens) {
      constraints.push({
        type: 'system',
        description: `Maximum ${identity.config.maxTokens} tokens per response`,
        enabled: true,
      });
    }
  }
  
  // Extract from personality
  if (identity.personality) {
    const constraintPatterns = [
      { type: 'safety', pattern: /never (.+?)\./i },
      { type: 'policy', pattern: /always (.+?)\./i },
      { type: 'user', pattern: /do not (.+?)\./i },
    ];
    
    for (const { type, pattern } of constraintPatterns) {
      const matches = identity.personality.match(pattern);
      if (matches) {
        constraints.push({
          type,
          description: matches[0],
          enabled: true,
        });
      }
    }
  }
  
  return constraints;
}

/**
 * Extract capabilities from identity
 */
function extractCapabilities(identity: Identity): Capability[] {
  const capabilities: Capability[] = [];
  
  // From tools
  if (identity.tools) {
    for (const tool of identity.tools) {
      capabilities.push({
        name: tool.name,
        type: 'tool',
        enabled: tool.enabled,
        config: tool.config,
      });
    }
  }
  
  // From skills
  if (identity.skills) {
    for (const skill of identity.skills) {
      capabilities.push({
        name: skill.name,
        type: 'skill',
        enabled: true,
      });
    }
  }
  
  return capabilities;
}

/**
 * Infer tone from personality
 */
function inferTone(personality?: string): ToneConfig | undefined {
  if (!personality) return undefined;
  
  const style: 'formal' | 'casual' | 'technical' | 'friendly' = 
    personality.includes('technical') ? 'technical' :
    personality.includes('friendly') ? 'friendly' :
    personality.length < 100 ? 'casual' : 'formal';
  
  const verbosity: 'brief' | 'moderate' | 'detailed' =
    personality.length < 100 ? 'brief' :
    personality.length < 500 ? 'moderate' : 'detailed';
  
  return { style, verbosity };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Compare two identity documents and generate semantic diff
 */
export function diff(from: AgentIdentity, to: AgentIdentity): SemanticDiff {
  const changes: DiffChange[] = [];
  
  // Compare goals
  compareArrays(from.goals, to.goals, 'goals', changes, (v) => v);
  
  // Compare constraints
  compareObjects(from.constraints, to.constraints, 'constraints', changes,
    (c) => c.description);
  
  // Compare capabilities
  compareObjects(from.capabilities, to.capabilities, 'capabilities', changes,
    (c) => c.name);
  
  // Compare tone
  if (JSON.stringify(from.tone) !== JSON.stringify(to.tone)) {
    changes.push({
      type: 'modified',
      path: 'tone',
      oldValue: from.tone,
      newValue: to.tone,
      description: `Tone changed from ${from.tone?.style || 'none'} to ${to.tone?.style || 'none'}`,
    });
  }
  
  // Compare memory config
  if (JSON.stringify(from.memory) !== JSON.stringify(to.memory)) {
    changes.push({
      type: 'modified',
      path: 'memory',
      oldValue: from.memory,
      newValue: to.memory,
      description: 'Memory configuration updated',
    });
  }
  
  // Build summary
  const summary: DiffSummary = {
    totalChanges: changes.length,
    additions: changes.filter(c => c.type === 'added').length,
    removals: changes.filter(c => c.type === 'removed').length,
    modifications: changes.filter(c => c.type === 'modified').length,
    breakingChanges: detectBreakingChanges(changes),
  };
  
  return {
    identityId: to.id,
    from: from.version,
    to: to.version,
    changes,
    summary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Compare arrays and generate changes
 */
function compareArrays<T>(
  from: T[],
  to: T[],
  path: string,
  changes: DiffChange[],
  keyFn: (item: T) => string
): void {
  const fromKeys = new Set(from.map(keyFn));
  const toKeys = new Set(to.map(keyFn));
  
  // Find additions
  for (let i = 0; i < to.length; i++) {
    if (!fromKeys.has(keyFn(to[i]))) {
      changes.push({
        type: 'added',
        path: `${path}[${i}]`,
        newValue: to[i],
        description: `Added: ${keyFn(to[i])}`,
      });
    }
  }
  
  // Find removals
  for (let i = 0; i < from.length; i++) {
    if (!toKeys.has(keyFn(from[i]))) {
      changes.push({
        type: 'removed',
        path: `${path}[${i}]`,
        oldValue: from[i],
        description: `Removed: ${keyFn(from[i])}`,
      });
    }
  }
}

/**
 * Compare object arrays
 */
function compareObjects<T extends Record<string, unknown>>(
  from: T[],
  to: T[],
  path: string,
  changes: DiffChange[],
  keyFn: (item: T) => string
): void {
  const fromMap = new Map(from.map(item => [keyFn(item), item]));
  const toMap = new Map(to.map(item => [keyFn(item), item]));
  
  for (const [key, newItem] of toMap) {
    const oldItem = fromMap.get(key);
    if (!oldItem) {
      changes.push({
        type: 'added',
        path: `${path}.${key}`,
        newValue: newItem,
        description: `Added ${key}`,
      });
    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      changes.push({
        type: 'modified',
        path: `${path}.${key}`,
        oldValue: oldItem,
        newValue: newItem,
        description: `Modified ${key}`,
      });
    }
  }
  
  for (const [key, oldItem] of fromMap) {
    if (!toMap.has(key)) {
      changes.push({
        type: 'removed',
        path: `${path}.${key}`,
        oldValue: oldItem,
        description: `Removed ${key}`,
      });
    }
  }
}

/**
 * Detect breaking changes
 */
function detectBreakingChanges(changes: DiffChange[]): string[] {
  const breaking: string[] = [];
  
  for (const change of changes) {
    // Removing constraints is potentially breaking
    if (change.type === 'removed' && change.path.includes('constraints')) {
      breaking.push(`Removed constraint: ${change.description}`);
    }
    
    // Disabling capabilities is breaking
    if (change.type === 'modified' && 
        change.path.includes('capabilities') &&
        change.newValue && 
        !(change.newValue as Record<string, unknown>).enabled) {
      breaking.push(`Disabled capability: ${change.path}`);
    }
  }
  
  return breaking;
}

/**
 * Format diff as human-readable text
 */
export function formatDiff(diff: SemanticDiff): string {
  let output = `# Semantic Diff: ${diff.identityId}\n`;
  output += `From: ${diff.from} → To: ${diff.to}\n`;
  output += `Generated: ${diff.timestamp}\n\n`;
  
  output += `## Summary\n`;
  output += `- Total Changes: ${diff.summary.totalChanges}\n`;
  output += `- Additions: ${diff.summary.additions}\n`;
  output += `- Removals: ${diff.summary.removals}\n`;
  output += `- Modifications: ${diff.summary.modifications}\n`;
  
  if (diff.summary.breakingChanges.length > 0) {
    output += `\n⚠️ Breaking Changes:\n`;
    for (const bc of diff.summary.breakingChanges) {
      output += `- ${bc}\n`;
    }
  }
  
  output += `\n## Changes\n`;
  for (const change of diff.changes) {
    const icon = change.type === 'added' ? '➕' : 
                 change.type === 'removed' ? '➖' : 
                 change.type === 'modified' ? '✏️' : '🔄';
    output += `${icon} ${change.description}\n`;
  }
  
  return output;
}

export default {
  fromIdentity,
  diff,
  formatDiff,
};
