/**
 * Deterministic Memory Checkpoint Ledger
 * 
 * Core reliability layer for agent resume with:
 * - Hash-linked append-only checkpoint ledger
 * - Scoped memory retrieval with provenance
 * - Deterministic restore behavior
 * - Namespace isolation
 * 
 * @see https://github.com/savestatedev/savestate/issues/47
 */

// Types
export {
  // Namespace
  Namespace,
  namespaceKey,
  
  // Goals & Tasks
  Goal,
  Task,
  Action,
  
  // Checkpoints
  Checkpoint,
  CreateCheckpointInput,
  
  // Memory
  MemoryObject,
  MemorySource,
  MemoryIngestionMetadata,
  ProvenanceEntry,
  CreateMemoryInput,
  
  // Retrieval
  MemoryQuery,
  RankingWeights,
  DEFAULT_RANKING_WEIGHTS,
  MemoryResult,
  
  // Restore
  ResumePack,
  RestoreRationale,
  RestoreOptions,
  
  // Audit
  AuditEntry,
  
  // Storage
  CheckpointStorage,
  ListOptions,
} from './types.js';

// Core services
export {
  CheckpointLedger,
  computeCheckpointHash,
  verifyCheckpointIntegrity,
  verifyChainIntegrity,
} from './ledger.js';

export {
  KnowledgeLane,
  calculateRecencyScore,
  calculateMemoryScore,
} from './memory.js';

export {
  RestoreService,
} from './restore.js';

// Storage backends
export { InMemoryCheckpointStorage } from './storage/index.js';
