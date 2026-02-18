/**
 * Core Integrity v1 + Decision Guard
 * 
 * Ensures memory/state integrity at retrieval and action time
 * with verifiable provenance.
 * 
 * Features:
 * - Validity status tracking (valid, suspect, invalid, unverified)
 * - Evidence bundle hashing for provenance
 * - Retrieval modes: stable_only, include_suspect, execute_safe
 * - Decision Guard for pre-action validation (post-GA pilot)
 * 
 * @see https://github.com/savestatedev/savestate/issues/68
 */

// Types
export {
  // Status & Reasons
  ValidityStatus,
  InvalidReason,
  
  // Integrity Metadata
  IntegrityMetadata,
  EvidenceBundle,
  EvidenceItem,
  
  // Retrieval
  RetrievalMode,
  IntegrityRetrievalOptions,
  IntegrityRetrievalResult,
  
  // Checkpoint Integration
  CheckpointIntegrityFields,
  
  // Decision Guard
  ActionEvaluationRequest,
  ActionEvaluationResult,
  
  // Policy
  ValidationRule,
  ValidationCondition,
  IntegrityPolicy,
} from './types.js';

// Validator
export {
  IntegrityValidator,
  DEFAULT_POLICY,
  ValidationResult,
  RuleValidationResult,
  ValidatableData,
  hashEvidenceBundle,
  createEvidenceBundle,
  verifyEvidenceBundle,
} from './validator.js';

// Retrieval
export {
  IntegrityRetrieval,
  filterByMode,
  passesIntegrityCheck,
  defaultRetrievalOptions,
} from './retrieval.js';

// Decision Guard (Post-GA Pilot)
export {
  DecisionGuard,
  RiskThresholds,
  EvaluableMemory,
} from './decision-guard.js';
