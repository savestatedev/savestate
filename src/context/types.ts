/**
 * Preflight Context Compiler Types
 * Issue #54: RunBrief schema and related types
 */

/**
 * A fact that must always be included in context
 */
export interface Fact {
  id: string;
  content: string;
  source: string;
  importance: number; // 0-1
  created_at: string;
  tags?: string[];
}

/**
 * An entity with tracked state
 */
export interface Entity {
  id: string;
  type: string;
  name: string;
  state: Record<string, unknown>;
  updated_at: string;
}

/**
 * An unfinished commitment or task
 */
export interface OpenLoop {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  due_at?: string;
  context?: string;
}

/**
 * A constraint that must be respected
 */
export interface Constraint {
  id: string;
  type: 'policy' | 'user' | 'system' | 'custom';
  description: string;
  source: string;
  active: boolean;
}

/**
 * A recent decision with rationale
 */
export interface Decision {
  id: string;
  description: string;
  rationale: string;
  made_at: string;
  confidence: number; // 0-1
}

/**
 * Explicitly missing information
 */
export interface Unknown {
  id: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  attempted_sources?: string[];
}

/**
 * Unresolved contradiction
 */
export interface Conflict {
  id: string;
  description: string;
  sources: string[];
  conflicting_values: unknown[];
  detected_at: string;
}

/**
 * Memory provenance citation
 */
export interface Citation {
  id: string;
  memory_id: string;
  source: string;
  retrieved_at: string;
  relevance_score: number;
}

/**
 * The compiled context package for an agent run
 */
export interface RunBrief {
  // Non-droppable critical information
  must_know_facts: Fact[];
  
  // Current state of tracked entities
  active_state: Record<string, Entity>;
  
  // Unfinished commitments/tasks
  open_loops: OpenLoop[];
  
  // Policy, user, system constraints
  constraints: Constraint[];
  
  // Recent decisions with rationale
  recent_decisions: Decision[];
  
  // Explicit missing information
  unknowns: Unknown[];
  
  // Unresolved contradictions
  conflicts: Conflict[];
  
  // Memory provenance
  citations: Citation[];
  
  // Metadata
  compiled_at: string;
  token_count: number;
  budget_remaining: number;
  run_id: string;
}

/**
 * Task description for context compilation
 */
export interface TaskDescription {
  intent: string;
  context?: string;
  required_capabilities?: string[];
  excluded_topics?: string[];
}

/**
 * Request to compile context
 */
export interface CompileRequest {
  agent_id: string;
  task: TaskDescription;
  token_budget: number;
  profile_id?: string;
}

/**
 * Explanation for why a candidate was included/excluded
 */
export interface CandidateExplanation {
  candidate_id: string;
  included: boolean;
  score: number;
  score_breakdown: {
    relevance: number;
    recency: number;
    importance: number;
    criticality: number;
    trust: number;
    redundancy_penalty: number;
  };
  reason: string;
}

/**
 * Full explanation trace for a compiled brief
 */
export interface ExplanationTrace {
  run_id: string;
  compiled_at: string;
  total_candidates: number;
  included_count: number;
  excluded_count: number;
  candidates: CandidateExplanation[];
  budget_allocation: {
    must_know_facts: number;
    constraints: number;
    open_loops: number;
    active_state: number;
    recent_decisions: number;
    conflicts: number;
    unknowns: number;
    citations: number;
  };
}

/**
 * Validation result for a RunBrief
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    constraints_covered: number;
    constraints_total: number;
    required_facts_present: boolean;
  };
}

/**
 * Scoring weights configuration
 */
export interface ScoringWeights {
  relevance: number;
  recency: number;
  importance: number;
  criticality: number;
  trust: number;
  redundancy: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  relevance: 0.30,
  recency: 0.15,
  importance: 0.20,
  criticality: 0.25,
  trust: 0.05,
  redundancy: 0.05,
};

/**
 * Budget allocation configuration
 */
export interface BudgetAllocation {
  must_know_facts_min: number;  // minimum percentage
  constraints_min: number;
  open_loops_min: number;
  active_state_max: number;     // maximum percentage
  recent_decisions_max: number;
  conflicts_max: number;
  unknowns_max: number;
  citations_max: number;
}

export const DEFAULT_BUDGET_ALLOCATION: BudgetAllocation = {
  must_know_facts_min: 0.15,
  constraints_min: 0.10,
  open_loops_min: 0.10,
  active_state_max: 0.25,
  recent_decisions_max: 0.20,
  conflicts_max: 0.10,
  unknowns_max: 0.05,
  citations_max: 0.05,
};
