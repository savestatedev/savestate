/**
 * Action Recall Drillbook Types
 * 
 * Pre-action memory reliability gate that tests high-risk facts
 * before costly actions, with source-anchored repair.
 * 
 * @see https://github.com/savestatedev/savestate/issues/73
 */

// ─── Drill Item ──────────────────────────────────────────────

/**
 * Action types that emit drill items
 */
export type EmittingAction =
  | 'decision_finalized'    // Chosen option + rejected alternatives
  | 'external_side_effect'  // API call, write, deploy, purchase
  | 'location_fact'         // File/path/line, ticket ID, deadline, owner
  | 'constraint_commitment'; // Budget, policy, scope lock

/**
 * A drillbook item - a fact to test before risky actions
 */
export interface DrillItem {
  /** Unique item identifier */
  id: string;
  
  /** The question to test recall */
  question: string;
  
  /** Expected answer (ground truth) */
  expected_answer: string;
  
  /** Reference to the source (file path, URL, checkpoint ID, etc.) */
  source_pointer: string;
  
  /** Importance score (1-5) */
  importance: number;
  
  /** ISO timestamp when this item expires */
  expiry?: string;
  
  /** Whether this is a critical item that must always be tested */
  critical: boolean;
  
  /** Conditions that invalidate this item */
  invalidate_on?: InvalidationCondition[];
  
  /** Type of action that created this item */
  action_type: EmittingAction;
  
  /** ISO timestamp when created */
  created_at: string;
  
  /** ISO timestamp when last tested */
  last_tested_at?: string;
  
  /** Number of times this item has been missed */
  miss_count: number;
  
  /** History of test results */
  test_history: TestResult[];
  
  /** Whether this item is still active */
  active: boolean;
  
  /** Reason if retired */
  retired_reason?: string;
  
  /** Replacement item ID if source changed */
  replaced_by?: string;
  
  /** Actor who created this item */
  created_by: string;
  
  /** Associated run/checkpoint */
  checkpoint_id?: string;
  
  /** Tags for filtering */
  tags?: string[];
}

/**
 * Conditions that can invalidate a drill item
 */
export interface InvalidationCondition {
  type: 'source_modified' | 'time_elapsed' | 'manual' | 'superseded';
  details?: string;
}

/**
 * Result of testing a drill item
 */
export interface TestResult {
  /** ISO timestamp of test */
  timestamp: string;
  
  /** The answer given */
  answer: string;
  
  /** Whether the answer was correct */
  correct: boolean;
  
  /** Similarity score (0-1) */
  similarity: number;
  
  /** Time taken to answer (ms) */
  response_time_ms: number;
}

/**
 * Input for creating a drill item
 */
export interface CreateDrillInput {
  question: string;
  expected_answer: string;
  source_pointer: string;
  importance?: number;
  expiry?: string;
  critical?: boolean;
  invalidate_on?: InvalidationCondition[];
  action_type: EmittingAction;
  created_by: string;
  checkpoint_id?: string;
  tags?: string[];
}

// ─── Test Protocol ───────────────────────────────────────────

/**
 * Configuration for the test protocol
 */
export interface TestProtocolConfig {
  /** Maximum time for test (ms) */
  max_duration_ms: number;
  
  /** Number of items to sample */
  sample_size: number;
  
  /** Weights for item sampling */
  sampling_weights: SamplingWeights;
}

/**
 * Weights for selecting items to test
 */
export interface SamplingWeights {
  /** Weight for importance score */
  importance: number;
  /** Weight for miss history (more misses = more likely to test) */
  miss_history: number;
  /** Weight for age (older items more likely) */
  age: number;
  /** Weight for change risk */
  change_risk: number;
}

export const DEFAULT_SAMPLING_WEIGHTS: SamplingWeights = {
  importance: 0.35,
  miss_history: 0.25,
  age: 0.20,
  change_risk: 0.20,
};

export const DEFAULT_PROTOCOL_CONFIG: TestProtocolConfig = {
  max_duration_ms: 20000, // 20 seconds
  sample_size: 6,         // 5-8 items
  sampling_weights: DEFAULT_SAMPLING_WEIGHTS,
};

/**
 * A test session
 */
export interface TestSession {
  /** Session identifier */
  session_id: string;
  
  /** Items selected for testing */
  items: DrillItem[];
  
  /** Results for each item */
  results: Map<string, TestResult>;
  
  /** ISO timestamp when session started */
  started_at: string;
  
  /** ISO timestamp when session ended */
  ended_at?: string;
  
  /** Overall readiness score */
  readiness_score?: number;
  
  /** Items that were missed */
  missed_items?: string[];
  
  /** Items that had critical failures */
  critical_failures?: string[];
}

// ─── Readiness Policy ────────────────────────────────────────

/**
 * Action cost levels
 */
export type ActionCostLevel = 'low' | 'medium' | 'high';

/**
 * Readiness thresholds by cost level
 */
export interface ReadinessThresholds {
  low: { min_score: number; allow_critical_miss: boolean };
  medium: { min_score: number; allow_critical_miss: boolean };
  high: { min_score: number; allow_critical_miss: boolean };
}

export const DEFAULT_READINESS_THRESHOLDS: ReadinessThresholds = {
  low: { min_score: 0, allow_critical_miss: true },        // No block, just log
  medium: { min_score: 0.75, allow_critical_miss: false },
  high: { min_score: 0.90, allow_critical_miss: false },
};

/**
 * Readiness check result
 */
export interface ReadinessResult {
  /** Whether the action is allowed */
  allowed: boolean;
  
  /** Readiness score (0-1) */
  score: number;
  
  /** The cost level checked against */
  cost_level: ActionCostLevel;
  
  /** Required threshold */
  threshold: number;
  
  /** Number of items tested */
  items_tested: number;
  
  /** Number of items passed */
  items_passed: number;
  
  /** Critical items that failed */
  critical_failures: string[];
  
  /** Recommendations if not allowed */
  recommendations?: string[];
}

// ─── Miss Handling ───────────────────────────────────────────

/**
 * Miss repair action
 */
export interface MissRepair {
  /** Original item that was missed */
  original_item_id: string;
  
  /** Source content retrieved */
  source_content?: string;
  
  /** Re-derived answer from source */
  corrected_answer?: string;
  
  /** Whether source has changed */
  source_changed: boolean;
  
  /** New replacement item (if source changed) */
  replacement_item?: DrillItem;
  
  /** Action taken */
  action: 'corrected' | 'retired' | 'replaced';
  
  /** ISO timestamp */
  repaired_at: string;
}

// ─── Storage Interface ───────────────────────────────────────

/**
 * Drillbook storage backend interface
 */
export interface DrillbookStorage {
  /** Save a drill item */
  saveItem(item: DrillItem): Promise<void>;
  
  /** Get an item by ID */
  getItem(id: string): Promise<DrillItem | null>;
  
  /** Get all active items for an actor */
  getActiveItems(created_by: string): Promise<DrillItem[]>;
  
  /** Get critical items for an actor */
  getCriticalItems(created_by: string): Promise<DrillItem[]>;
  
  /** Search items by tags */
  searchByTags(tags: string[]): Promise<DrillItem[]>;
  
  /** Update item test result */
  recordTestResult(item_id: string, result: TestResult): Promise<void>;
  
  /** Retire an item */
  retireItem(item_id: string, reason: string, replaced_by?: string): Promise<void>;
  
  /** Get items due for testing (not tested recently, high importance) */
  getItemsDueForTesting(created_by: string, limit: number): Promise<DrillItem[]>;
}
