/**
 * Deterministic Memory Checkpoint Ledger Types
 * 
 * Core types for the checkpoint system that enables reliable agent resume.
 * Implements hash-linked append-only ledger with namespace isolation.
 * 
 * @see https://github.com/savestatedev/savestate/issues/47
 */

// ─── Namespace ───────────────────────────────────────────────

/**
 * First-class partition key for checkpoint isolation.
 * All queries are scoped to a namespace.
 */
export interface Namespace {
  /** Organization identifier */
  org_id: string;
  /** Application identifier */
  app_id: string;
  /** Agent identifier */
  agent_id: string;
  /** User/session identifier (optional for shared agents) */
  user_id?: string;
}

/**
 * Serialize namespace to a deterministic string key
 */
export function namespaceKey(ns: Namespace): string {
  const parts = [ns.org_id, ns.app_id, ns.agent_id];
  if (ns.user_id) parts.push(ns.user_id);
  return parts.join(':');
}

// ─── Goals & Tasks ───────────────────────────────────────────

export interface Goal {
  id: string;
  description: string;
  status: 'active' | 'completed' | 'blocked' | 'cancelled';
  parent_goal_id?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: string;
  goal_id?: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  priority: number;
  dependencies?: string[];
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface Action {
  id: string;
  task_id?: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  result?: unknown;
  error?: string;
  created_at: string;
  completed_at?: string;
}

// ─── Checkpoint ──────────────────────────────────────────────

/**
 * Core checkpoint schema (V1)
 * 
 * Represents an immutable snapshot of agent state at a specific moment.
 * Hash-linked to parent for integrity verification.
 */
export interface Checkpoint {
  /** Unique checkpoint identifier (UUID v4) */
  checkpoint_id: string;
  
  /** Hash-linked parent checkpoint (null for genesis) */
  parent_checkpoint_id: string | null;
  
  /** Namespace for isolation */
  namespace: Namespace;
  
  /** Run identifier for grouping checkpoints in a session */
  run_id: string;
  
  /** Sequential step index within the run */
  step_index: number;
  
  /** Current goal stack (active goals in priority order) */
  goal_stack: Goal[];
  
  /** Actions waiting to execute */
  pending_actions: Action[];
  
  /** Tool-specific state (serializable) */
  tool_state: Record<string, unknown>;
  
  /** Policy flags affecting behavior */
  policy_flags: string[];
  
  /** Tasks not yet resolved */
  unresolved_tasks: Task[];
  
  /** References to memory objects in the knowledge lane */
  memory_refs: string[];
  
  /** ISO 8601 creation timestamp */
  created_at: string;
  
  /** Identifier of the writer (agent/system that created this) */
  writer_id: string;
  
  /** SHA-256 hash of checkpoint contents for integrity */
  state_hash: string;
  
  /** Schema version for migrations */
  schema_version: number;
}

/**
 * Input for creating a new checkpoint
 */
export interface CreateCheckpointInput {
  namespace: Namespace;
  run_id: string;
  goal_stack?: Goal[];
  pending_actions?: Action[];
  tool_state?: Record<string, unknown>;
  policy_flags?: string[];
  unresolved_tasks?: Task[];
  memory_refs?: string[];
  writer_id: string;
}

// ─── Memory / Knowledge Lane ─────────────────────────────────

/**
 * Memory object with provenance tracking.
 * Stored in the "knowledge lane" for semantic retrieval.
 */
export interface MemoryObject {
  /** Unique memory identifier */
  memory_id: string;
  
  /** Namespace for isolation */
  namespace: Namespace;
  
  /** Memory content */
  content: string;
  
  /** Content type (text, json, code, etc.) */
  content_type: string;
  
  /** Where this memory came from */
  source: MemorySource;

  /** Ingestion metadata for provenance and trust decisions */
  ingestion: MemoryIngestionMetadata;
  
  /** Provenance chain for auditability */
  provenance: ProvenanceEntry[];
  
  /** Tags for filtering and retrieval */
  tags: string[];
  
  /** Importance score (0-1) for ranking */
  importance: number;
  
  /** Task criticality score (0-1) */
  task_criticality: number;
  
  /** Optional vector embedding for semantic search */
  embedding?: number[];
  
  /** ISO 8601 creation timestamp */
  created_at: string;
  
  /** ISO 8601 last access timestamp */
  last_accessed_at?: string;
  
  /** Time-to-live in seconds (null = permanent) */
  ttl_seconds?: number;
  
  /** Associated checkpoint IDs */
  checkpoint_refs: string[];
}

export interface MemorySource {
  type: 'user_input' | 'tool_output' | 'web_scrape' | 'agent_inference' | 'external' | 'system';
  identifier: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryIngestionMetadata {
  source_type: 'user_input' | 'tool_output' | 'web_scrape' | 'system';
  source_id: string;
  ingestion_timestamp: string;
  confidence_score: number;
  detected_format: 'text' | 'json' | 'html' | 'markdown';
  anomaly_flags: string[];
  quarantined: boolean;
  validation_notes: string[];
}

export interface ProvenanceEntry {
  action: 'created' | 'accessed' | 'modified' | 'cited' | 'invalidated';
  actor_id: string;
  checkpoint_id?: string;
  timestamp: string;
  reason?: string;
}

/**
 * Input for storing a new memory
 */
export interface CreateMemoryInput {
  namespace: Namespace;
  content: string;
  content_type?: string;
  source: Omit<MemorySource, 'timestamp'>;
  tags?: string[];
  importance?: number;
  task_criticality?: number;
  embedding?: number[];
  ttl_seconds?: number;
}

// ─── Memory Retrieval ────────────────────────────────────────

/**
 * Query for ranked memory retrieval
 */
export interface MemoryQuery {
  namespace: Namespace;

  /** Semantic query text */
  query?: string;

  /** Filter by tags (AND logic) */
  tags?: string[];

  /** Filter by source type */
  source_types?: MemorySource['type'][];

  /** Minimum importance threshold */
  min_importance?: number;

  /**
   * Minimum semantic similarity required to include a result when `query` is provided.
   *
   * Helps prevent irrelevant high-importance / high-criticality memories from surfacing
   * when they do not match the current context.
   */
  min_semantic_similarity?: number;

  /**
   * Maximum allowed age (in seconds) based on the most recent of:
   * - last_accessed_at (if present)
   * - created_at
   *
   * Used for staleness filtering to avoid injecting outdated context.
   */
  max_age_seconds?: number;

  /** Maximum results to return */
  limit?: number;

  /** Include memory content in results */
  include_content?: boolean;

  /** Custom ranking weights (overrides defaults) */
  ranking_weights?: RankingWeights;
}

/**
 * Ranking formula weights
 * Default: task_criticality=0.45, semantic=0.25, importance=0.20, recency=0.10
 */
export interface RankingWeights {
  task_criticality: number;
  semantic_similarity: number;
  importance: number;
  recency_decay: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  task_criticality: 0.45,
  semantic_similarity: 0.25,
  importance: 0.20,
  recency_decay: 0.10,
};

/**
 * Ranked memory result
 */
export interface MemoryResult {
  memory_id: string;
  score: number;
  score_components: {
    task_criticality: number;
    semantic_similarity: number;
    importance: number;
    recency: number;
  };

  /**
   * Staleness hints (best-effort).
   * These fields are optional to preserve backwards compatibility.
   */
  is_stale?: boolean;
  age_days?: number;
  stale_reason?: string;

  content?: string;
  tags: string[];
  source: MemorySource;
  provenance: ProvenanceEntry[];
}

// ─── Restore ─────────────────────────────────────────────────

/**
 * Resume pack returned by restore API.
 * Contains everything needed to resume agent execution.
 */
export interface ResumePack {
  /** The checkpoint being restored from */
  checkpoint: Checkpoint;
  
  /** Tasks that need resolution */
  unresolved_tasks: Task[];
  
  /** Relevant memories for current context */
  memories: MemoryResult[];
  
  /** Explanation of restore decisions */
  rationale: RestoreRationale;
  
  /** Timestamp of restore operation */
  restored_at: string;
}

export interface RestoreRationale {
  /** Why this checkpoint was selected */
  checkpoint_selection: string;
  
  /** Why these memories were included */
  memory_selection: string[];
  
  /** Any warnings or considerations */
  warnings: string[];
  
  /** Provenance IDs used in decision */
  evidence_refs: string[];
}

/**
 * Options for restore operation
 */
export interface RestoreOptions {
  namespace: Namespace;
  
  /** Specific checkpoint ID (default: latest) */
  checkpoint_id?: string;
  
  /** Run ID to restore from */
  run_id?: string;
  
  /** Memory query for context retrieval */
  memory_query?: Omit<MemoryQuery, 'namespace'>;
  
  /** Maximum memories to include */
  max_memories?: number;
}

// ─── Audit ───────────────────────────────────────────────────

/**
 * Audit log entry for access tracking
 */
export interface AuditEntry {
  id: string;
  namespace: Namespace;
  action: 'create' | 'read' | 'restore' | 'search' | 'delete' | 'update';
  resource_type: 'checkpoint' | 'memory';
  resource_id: string;
  actor_id: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Storage Backend ─────────────────────────────────────────

/**
 * Storage backend interface for checkpoint persistence.
 * Implementations can use Postgres, SQLite, S3, etc.
 */
export interface CheckpointStorage {
  // Checkpoint operations
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
  getCheckpoint(checkpoint_id: string): Promise<Checkpoint | null>;
  getLatestCheckpoint(namespace: Namespace, run_id?: string): Promise<Checkpoint | null>;
  listCheckpoints(namespace: Namespace, options?: ListOptions): Promise<Checkpoint[]>;
  
  // Memory operations
  saveMemory(memory: MemoryObject): Promise<void>;
  saveQuarantinedMemory(memory: MemoryObject): Promise<void>;
  getMemory(memory_id: string): Promise<MemoryObject | null>;
  getQuarantinedMemory(memory_id: string): Promise<MemoryObject | null>;
  listQuarantinedMemories(namespace: Namespace, options?: ListOptions): Promise<MemoryObject[]>;
  deleteQuarantinedMemory(memory_id: string): Promise<void>;
  searchMemories(query: MemoryQuery): Promise<MemoryResult[]>;
  updateMemoryAccess(memory_id: string, checkpoint_id?: string): Promise<void>;
  
  // Audit operations
  logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void>;
  getAuditLog(namespace: Namespace, options?: ListOptions): Promise<AuditEntry[]>;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}
