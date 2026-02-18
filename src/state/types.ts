/**
 * Path-Addressable State Filesystem Types
 * 
 * Typed, versioned paths with provenance for deterministic state retrieval.
 * Alternative to chunk-based RAG with better auditability.
 * 
 * @see https://github.com/savestatedev/savestate/issues/70
 */

// ─── State Object ────────────────────────────────────────────

/**
 * Value types supported in state objects
 */
export type StateValueType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'text'      // Long-form text
  | 'code'      // Source code
  | 'datetime'
  | 'reference'; // Reference to another path

/**
 * State object stored at a path
 */
export interface StateObject<T = unknown> {
  /** Full path (e.g., /user/123/preferences/theme) */
  path: string;
  
  /** Value type for validation */
  type: StateValueType;
  
  /** The actual value */
  value: T;
  
  /** Monotonically increasing version number */
  version: number;
  
  /** ISO timestamp of last update */
  updated_at: string;
  
  /** ISO timestamp of creation */
  created_at: string;
  
  /** Writer identifier (agent, user, system) */
  writer: string;
  
  /** Confidence score (0-1) for this value */
  confidence: number;
  
  /** Time-to-live in seconds (null = permanent) */
  ttl?: number;
  
  /** References to evidence supporting this value */
  evidence_refs: string[];
  
  /** Optional description/documentation */
  description?: string;
  
  /** Tags for filtering */
  tags?: string[];
}

/**
 * Input for writing a state value
 */
export interface WriteInput<T = unknown> {
  /** Path to write to */
  path: string;
  
  /** Value to write */
  value: T;
  
  /** Value type (auto-detected if not provided) */
  type?: StateValueType;
  
  /** Writer identifier */
  writer: string;
  
  /** Expected version for optimistic locking (optional) */
  expected_version?: number;
  
  /** Evidence references */
  evidence_refs?: string[];
  
  /** Confidence score (defaults to 1.0) */
  confidence?: number;
  
  /** TTL in seconds */
  ttl?: number;
  
  /** Description */
  description?: string;
  
  /** Tags */
  tags?: string[];
}

/**
 * Write result
 */
export interface WriteResult {
  path: string;
  version: number;
  updated_at: string;
  success: boolean;
  error?: string;
}

// ─── Path Operations ─────────────────────────────────────────

/**
 * List options for prefix queries
 */
export interface ListOptions {
  /** Maximum results */
  limit?: number;
  
  /** Pagination offset */
  offset?: number;
  
  /** Include values in results */
  include_values?: boolean;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Filter by minimum confidence */
  min_confidence?: number;
  
  /** Sort order */
  order?: 'asc' | 'desc';
  
  /** Sort by field */
  sort_by?: 'path' | 'updated_at' | 'confidence' | 'version';
}

/**
 * List result item
 */
export interface ListItem {
  path: string;
  type: StateValueType;
  version: number;
  updated_at: string;
  confidence: number;
  value?: unknown;
}

// ─── Resolve (Hybrid Search) ─────────────────────────────────

/**
 * Actor context for resolve queries
 */
export interface ActorContext {
  /** Actor identifier */
  actor_id: string;
  
  /** Actor type */
  actor_type: 'agent' | 'user' | 'system';
  
  /** Current task or goal (for relevance) */
  current_task?: string;
  
  /** Paths recently accessed by this actor */
  recent_paths?: string[];
  
  /** Tags of interest */
  interested_tags?: string[];
}

/**
 * Resolve query for finding relevant paths
 */
export interface ResolveQuery {
  /** Natural language query */
  query: string;
  
  /** Actor context for personalization */
  actor_context?: ActorContext;
  
  /** Path prefix filter */
  prefix?: string;
  
  /** Maximum results */
  limit?: number;
  
  /** Minimum relevance score (0-1) */
  min_score?: number;
  
  /** Include values in results */
  include_values?: boolean;
}

/**
 * Resolve result with ranking
 */
export interface ResolveResult {
  /** Matching path */
  path: string;
  
  /** Relevance score (0-1) */
  score: number;
  
  /** Why this path matched */
  reason: string;
  
  /** Score breakdown */
  score_components: {
    bm25: number;
    embedding?: number;
    recency: number;
    confidence: number;
  };
  
  /** The state object (if include_values) */
  state?: StateObject;
}

// ─── Bundle (Context Assembly) ────────────────────────────────

/**
 * Bundle strategy for context assembly
 */
export type BundleStrategy = 
  | 'full'        // Include full values
  | 'summary'     // Summarize long values
  | 'references'; // Only include citations

/**
 * Bundle request
 */
export interface BundleRequest {
  /** Paths to include in bundle */
  paths: string[];
  
  /** Maximum token budget */
  token_budget: number;
  
  /** Assembly strategy */
  strategy: BundleStrategy;
  
  /** Custom priority order (path -> priority) */
  priorities?: Record<string, number>;
}

/**
 * Bundled state packet
 */
export interface StateBundle {
  /** Assembled context (formatted for LLM) */
  context: string;
  
  /** Actual token count */
  token_count: number;
  
  /** Paths included */
  included_paths: string[];
  
  /** Paths excluded due to budget */
  excluded_paths: string[];
  
  /** Citations for provenance */
  citations: Citation[];
  
  /** Bundle metadata */
  metadata: {
    strategy: BundleStrategy;
    budget: number;
    created_at: string;
  };
}

/**
 * Citation for provenance tracking
 */
export interface Citation {
  path: string;
  version: number;
  evidence_refs: string[];
  confidence: number;
}

// ─── Path Schema ─────────────────────────────────────────────

/**
 * Common path patterns
 */
export const PATH_PATTERNS = {
  /** User preferences: /user/{user_id}/preferences/{key} */
  USER_PREFERENCE: /^\/user\/([^/]+)\/preferences\/([^/]+)$/,
  
  /** Project decisions: /project/{project_id}/decisions/{date} */
  PROJECT_DECISION: /^\/project\/([^/]+)\/decisions\/(\d{4}-\d{2}-\d{2})$/,
  
  /** Project constraints: /project/{project_id}/constraints/{key} */
  PROJECT_CONSTRAINT: /^\/project\/([^/]+)\/constraints\/([^/]+)$/,
  
  /** Agent procedures: /agent/{agent_id}/procedures/{name} */
  AGENT_PROCEDURE: /^\/agent\/([^/]+)\/procedures\/([^/]+)$/,
  
  /** System config: /system/config/{key} */
  SYSTEM_CONFIG: /^\/system\/config\/([^/]+)$/,
  
  /** Session state: /session/{session_id}/{key} */
  SESSION_STATE: /^\/session\/([^/]+)\/([^/]+)$/,
};

/**
 * Path builder utilities
 */
export const PathBuilder = {
  userPreference: (userId: string, key: string) => 
    `/user/${userId}/preferences/${key}`,
  
  projectDecision: (projectId: string, date: string) => 
    `/project/${projectId}/decisions/${date}`,
  
  projectConstraint: (projectId: string, key: string) => 
    `/project/${projectId}/constraints/${key}`,
  
  agentProcedure: (agentId: string, name: string) => 
    `/agent/${agentId}/procedures/${name}`,
  
  systemConfig: (key: string) => 
    `/system/config/${key}`,
  
  sessionState: (sessionId: string, key: string) => 
    `/session/${sessionId}/${key}`,
};

// ─── Storage Interface ───────────────────────────────────────

/**
 * State filesystem storage backend interface
 */
export interface StateStorage {
  /** Write a state object */
  write(input: WriteInput): Promise<WriteResult>;
  
  /** Get a state object by path */
  get(path: string): Promise<StateObject | null>;
  
  /** Get a specific version */
  getVersion(path: string, version: number): Promise<StateObject | null>;
  
  /** List objects by prefix */
  list(prefix: string, options?: ListOptions): Promise<ListItem[]>;
  
  /** Delete a path */
  delete(path: string): Promise<boolean>;
  
  /** Check if path exists */
  exists(path: string): Promise<boolean>;
  
  /** Get version history */
  history(path: string, limit?: number): Promise<StateObject[]>;
}
