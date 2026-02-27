/**
 * SaveState Archive Format (SAF) Types
 *
 * The SAF is an open format for capturing AI agent state.
 * Structure: tar.gz → AES-256-GCM encrypted → .saf.enc
 */

import type { SnapshotTrace } from './trace/types.js';

// ─── Manifest ────────────────────────────────────────────────

export interface Manifest {
  /** SAF format version */
  version: string;
  /** ISO 8601 timestamp of snapshot creation */
  timestamp: string;
  /** Unique snapshot identifier */
  id: string;
  /** Source platform identifier */
  platform: string;
  /** Adapter used to create this snapshot */
  adapter: string;
  /** SHA-256 checksum of the unencrypted archive */
  checksum: string;
  /** Parent snapshot ID (for incremental snapshots) */
  parent?: string;
  /** Human-readable label */
  label?: string;
  /** Tags for organization */
  tags?: string[];
  /** Size in bytes of the unencrypted archive */
  size: number;
}

// ─── Identity ────────────────────────────────────────────────

export interface Identity {
  /** System prompt / personality / SOUL document */
  personality?: string;
  /** Configuration and settings */
  config?: Record<string, unknown>;
  /** Tool/plugin/skill configurations */
  tools?: ToolConfig[];
  /** Skills with their configs and scripts */
  skills?: SkillEntry[];
  /** Custom user scripts */
  scripts?: ScriptEntry[];
  /** Extension configurations (not code/node_modules) */
  extensions?: ExtensionEntry[];
  /** Project file manifest (paths + sizes, no content) */
  fileManifest?: FileManifestEntry[];
  /** Project metadata files (package.json, pyproject.toml, etc.) */
  projectMeta?: Record<string, string>;
}

export interface ToolConfig {
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface SkillEntry {
  /** Skill directory name */
  name: string;
  /** SKILL.md content */
  skillMd?: string;
  /** Files in the skill (relative path → content) */
  files: Record<string, string>;
}

export interface ScriptEntry {
  /** Relative path from workspace root */
  path: string;
  /** Script content */
  content: string;
  /** Whether this is a cron wrapper */
  isCronWrapper: boolean;
}

export interface ExtensionEntry {
  /** Extension directory name */
  name: string;
  /** Config files in the extension (relative path → content) */
  configs: Record<string, string>;
}

export interface FileManifestEntry {
  /** Relative file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified ISO timestamp */
  modified: string;
}

// ─── Memory ──────────────────────────────────────────────────

/**
 * Memory tier levels for the multi-tier architecture:
 * - L1: Short-term buffer (current session/window, fastest access)
 * - L2: Working set (recent + pinned items, fast retrieval)
 * - L3: Long-term archive (full history, slower retrieval, searchable)
 */
export type MemoryTier = 'L1' | 'L2' | 'L3';

export interface Memory {
  /** Platform memory entries (ChatGPT memories, Claude memory, etc.) */
  core: MemoryEntry[];
  /** Knowledge base documents */
  knowledge: KnowledgeDocument[];
  /** Optional vector embeddings for search */
  embeddings?: EmbeddingData;
  /** Memory tier configuration and metadata */
  tierConfig?: MemoryTierConfig;
}

/**
 * Configuration for the multi-tier memory system.
 */
export interface MemoryTierConfig {
  /** Schema version for tier config */
  version: string;
  /** Default tier for new memories */
  defaultTier: MemoryTier;
  /** Automatic tier policies */
  policies?: MemoryTierPolicy[];
  /** Tier-specific settings */
  tiers: {
    L1: TierSettings;
    L2: TierSettings;
    L3: TierSettings;
  };
}

export interface TierSettings {
  /** Maximum number of items in this tier (null = unlimited) */
  maxItems?: number | null;
  /** Maximum age before auto-demotion (e.g., '24h', '7d', '30d') */
  maxAge?: string | null;
  /** Whether items in this tier are included in default context */
  includeInContext: boolean;
}

export interface MemoryTierPolicy {
  /** Policy name */
  name: string;
  /** Condition for triggering the policy */
  trigger: 'age' | 'access' | 'overflow' | 'manual';
  /** Source tier */
  from: MemoryTier;
  /** Destination tier */
  to: MemoryTier;
  /** Condition threshold (e.g., '7d' for age, count for overflow) */
  threshold?: string | number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  /** Memory tier (L1/L2/L3). Defaults to L3 for backward compatibility. */
  tier?: MemoryTier;
  /** Whether this memory is pinned (prevents automatic demotion) */
  pinned?: boolean;
  /** ISO 8601 timestamp when the memory was pinned */
  pinnedAt?: string;
  /** ISO 8601 timestamp of last access (for LRU-style policies) */
  lastAccessedAt?: string;
  /** ISO 8601 timestamp when promoted to current tier */
  promotedAt?: string;
  /** ISO 8601 timestamp when demoted to current tier */
  demotedAt?: string;
  /** Previous tier before last promotion/demotion */
  previousTier?: MemoryTier;
}

export interface KnowledgeDocument {
  id: string;
  filename: string;
  mimeType: string;
  /** Relative path within the archive */
  path: string;
  size: number;
  checksum: string;
}

export interface EmbeddingData {
  model: string;
  dimensions: number;
  /** Path to binary embeddings file */
  path: string;
}

// ─── Conversations ───────────────────────────────────────────

export interface ConversationIndex {
  total: number;
  conversations: ConversationMeta[];
}

export interface ConversationMeta {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  /** Relative path to the conversation JSON */
  path: string;
}

export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Meta ────────────────────────────────────────────────────

export interface PlatformMeta {
  name: string;
  version?: string;
  apiVersion?: string;
  accountId?: string;
  exportMethod: string;
}

export interface SnapshotChain {
  current: string;
  parent?: string;
  /** Full chain of ancestor snapshot IDs (oldest first) */
  ancestors: string[];
}

export interface RestoreHints {
  platform: string;
  /** Steps needed for restore on this platform */
  steps: RestoreStep[];
  /** Capabilities that can't be auto-restored */
  manualSteps?: string[];
}

export interface RestoreStep {
  type: 'api' | 'file' | 'manual';
  description: string;
  target: string;
  data?: string;
}

// ─── Snapshot (top-level archive structure) ──────────────────

export interface Snapshot {
  manifest: Manifest;
  identity: Identity;
  memory: Memory;
  conversations: ConversationIndex;
  platform: PlatformMeta;
  chain: SnapshotChain;
  restoreHints: RestoreHints;
  trace?: SnapshotTrace;
}

// ─── Adapter Interface ───────────────────────────────────────

export interface Adapter {
  /** Unique adapter identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Platform this adapter targets */
  readonly platform: string;
  /** Adapter version */
  readonly version: string;

  /** Check if this adapter can operate in the current environment */
  detect(): Promise<boolean>;

  /** Extract current state from the platform */
  extract(): Promise<Snapshot>;

  /** Restore state to the platform */
  restore(snapshot: Snapshot): Promise<void>;

  /** Get platform-specific identity information */
  identify(): Promise<PlatformMeta>;
}

// ─── Storage Backend Interface ───────────────────────────────

export interface StorageBackend {
  /** Backend identifier (e.g., 'local', 's3', 'r2') */
  readonly id: string;

  /** Store encrypted data */
  put(key: string, data: Buffer): Promise<void>;

  /** Retrieve encrypted data */
  get(key: string): Promise<Buffer>;

  /** List all stored keys, optionally filtered by prefix */
  list(prefix?: string): Promise<string[]>;

  /** Delete stored data */
  delete(key: string): Promise<void>;

  /** Check if a key exists */
  exists(key: string): Promise<boolean>;
}

// ─── Config ──────────────────────────────────────────────────

export interface SaveStateConfig {
  /** Config format version */
  version: string;
  /** Storage backend configuration */
  storage: StorageConfig;
  /** Default adapter to use */
  defaultAdapter?: string;
  /** Auto-snapshot schedule (cron expression or interval) */
  schedule?: string;
  /** Snapshot retention policy */
  retention?: RetentionPolicy;
  /** Registered adapters */
  adapters: AdapterConfig[];
}

export interface StorageConfig {
  /** Backend type: 'local' | 's3' | 'r2' | 'b2' | 'filesystem' */
  type: string;
  /** Backend-specific options */
  options: Record<string, unknown>;
}

export interface RetentionPolicy {
  /** Maximum number of snapshots to keep */
  maxSnapshots?: number;
  /** Maximum age of snapshots (e.g., '90d', '1y') */
  maxAge?: string;
  /** Keep at least one snapshot per period */
  keepPer?: 'day' | 'week' | 'month';
}

export interface AdapterConfig {
  id: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

// ─── Search ──────────────────────────────────────────────────

export interface SearchResult {
  snapshotId: string;
  snapshotTimestamp: string;
  type: 'memory' | 'conversation' | 'identity' | 'knowledge';
  /** The matching content */
  content: string;
  /** Context around the match */
  context?: string;
  /** Relevance score (0-1) */
  score: number;
  /** Source path within the archive */
  path: string;
}

// ─── Retrieval Explainability ────────────────────────────────

/**
 * Detailed explanation of why a memory was selected/retrieved.
 * Addresses the "black box retrieval" concern for production users.
 */
export interface RetrievalExplanation {
  /** Memory entry ID being explained */
  memoryId: string;
  /** Overall composite score (0-1) */
  compositeScore: number;
  /** Breakdown of individual scoring factors */
  scoreBreakdown: ScoreBreakdown;
  /** Source tracing information */
  sourceTrace: SourceTrace;
  /** Policy rules that affected this memory */
  policyPath: PolicyPathEntry[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Breakdown of scoring factors contributing to retrieval.
 */
export interface ScoreBreakdown {
  /** Base relevance score from content similarity (0-1) */
  relevanceScore: number;
  /** Recency weight based on age (0-1, newer = higher) */
  recencyWeight: number;
  /** Tier boost factor (L1 > L2 > L3) */
  tierBoost: number;
  /** Access frequency boost */
  accessBoost: number;
  /** Pinned status boost */
  pinnedBoost: number;
  /** Individual factor contributions with explanations */
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  /** Factor name */
  name: string;
  /** Factor value (0-1) */
  value: number;
  /** Weight applied to this factor */
  weight: number;
  /** Contribution to final score (value * weight) */
  contribution: number;
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Source tracing: where did this memory come from?
 */
export interface SourceTrace {
  /** Original snapshot ID where memory was created */
  originSnapshotId: string;
  /** Timestamp of origin snapshot */
  originTimestamp: string;
  /** Adapter that captured this memory */
  adapter: string;
  /** Platform identifier */
  platform: string;
  /** Current snapshot ID (may differ if memory was migrated) */
  currentSnapshotId: string;
  /** Chain of snapshots this memory has been part of */
  snapshotChain: string[];
  /** Original source identifier (e.g., conversation ID, file path) */
  sourceId?: string;
  /** Source type */
  sourceType: 'conversation' | 'manual' | 'import' | 'system' | 'unknown';
}

/**
 * Policy path entry showing which rules affected this memory.
 */
export interface PolicyPathEntry {
  /** Policy name */
  policyName: string;
  /** Rule type (age, access, overflow, manual) */
  ruleType: 'age' | 'access' | 'overflow' | 'manual' | 'tier' | 'pin';
  /** Action taken */
  action: 'include' | 'exclude' | 'promote' | 'demote' | 'boost' | 'penalize';
  /** Timestamp when rule was applied */
  appliedAt?: string;
  /** Human-readable reason */
  reason: string;
}

// ─── Diff ────────────────────────────────────────────────────

export interface DiffResult {
  snapshotA: string;
  snapshotB: string;
  changes: DiffChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  category: 'identity' | 'memory' | 'conversation' | 'tool';
  path: string;
  description: string;
  before?: string;
  after?: string;
}
