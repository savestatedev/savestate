/**
 * SaveState — Time Machine for AI
 *
 * Public API for programmatic usage.
 */

// Core types
export type {
  Manifest,
  Identity,
  Memory,
  MemoryEntry,
  KnowledgeDocument,
  Conversation,
  ConversationIndex,
  ConversationMeta,
  Message,
  Snapshot,
  PlatformMeta,
  SnapshotChain,
  RestoreHints,
  RestoreStep,
  ToolConfig,
  SkillEntry,
  ScriptEntry,
  ExtensionEntry,
  FileManifestEntry,
  EmbeddingData,
  Adapter,
  StorageBackend,
  SaveStateConfig,
  StorageConfig,
  RetentionPolicy,
  AdapterConfig,
  SearchResult,
  DiffResult,
  DiffChange,
} from './types.js';

// Encryption
export { encrypt, decrypt, verify } from './encryption.js';

// Format
export {
  packSnapshot,
  unpackSnapshot,
  computeChecksum,
  generateSnapshotId,
  snapshotFilename,
  SAF_EXTENSION,
  SAF_VERSION,
} from './format.js';

// Config
export {
  loadConfig,
  saveConfig,
  initializeProject,
  isInitialized,
  defaultConfig,
  SAVESTATE_DIR,
  GLOBAL_SAVESTATE_DIR,
} from './config.js';

// Snapshot
export { createSnapshot, getLatestSnapshotId } from './snapshot.js';

// Incremental
export {
  computeContentHashes,
  computeDelta,
  packDelta,
  reconstructFromChain,
  getParentHashes,
  isIncremental,
  getDeltaManifest,
  MAX_CHAIN_DEPTH,
  FULL_SNAPSHOT_THRESHOLD,
} from './incremental.js';
export type {
  ContentHashes,
  DeltaEntry,
  DeltaManifest,
  DeltaResult,
} from './incremental.js';

// Trace ledger
export {
  TraceStore,
  TRACE_SCHEMA_VERSION,
  type TraceStoreOptions,
  type TraceExportFormat,
  type TraceExportTarget,
  type JsonValue,
  type TraceEvent,
  type TraceEventType,
  type TraceRunIndexEntry,
  type TraceIndexFile,
  type SnapshotTrace,
} from './trace/index.js';

// Restore
export { restoreSnapshot, validateSnapshot } from './restore.js';

// Search
export { searchSnapshots, scoreMatch } from './search.js';

// Storage
export { LocalStorageBackend } from './storage/index.js';

// Adapters
export {
  ClawdbotAdapter,
  ClaudeCodeAdapter,
  OpenAIAssistantsAdapter,
  listAdapters,
  getAdapter,
  detectAdapter,
  getAdapterInfo,
} from './adapters/index.js';

// Failure Antibody System (MVP)
export {
  AntibodyStore,
  AntibodyCompiler,
  deriveRuleId,
  AntibodyEngine,
} from './antibodies/index.js';
export type {
  Intervention,
  RiskLevel,
  SafeActionType,
  SafeAction,
  FailureEvent,
  FailureEventBase,
  UserCorrectionEvent,
  ToolFailureEvent,
  AntibodyTrigger,
  AntibodyScope,
  AntibodyRule,
  AntibodyStoreFile,
  AntibodyStats,
  PreflightContext,
  PreflightWarning,
  PreflightResult,
  AntibodyEngineOptions,
  PreflightOptions,
  ListRulesOptions,
} from './antibodies/index.js';

// Privacy Controls
export {
  // PII Detection & Redaction
  detectPII,
  redactPII,
  containsPII,
  summarizePII,
  // Deny-List Policy Engine
  evaluateDenyList,
  applyDenyList,
  createPolicy,
  addRule,
  removeRule,
  getBuiltinRuleSets,
  getBuiltinRules,
  // Field-Level Encryption
  encryptField,
  decryptField,
  isEncryptedField,
  encryptFields,
  decryptFields,
  rotateFieldKeys,
  defaultFieldEncryptionConfig,
  // Deletion Attestations
  createPIIAttestation,
  createDenyListAttestation,
  createRetentionAttestation,
  createManualDeletionAttestation,
  createAttestationLog,
  addAttestation,
  finalizeAttestationLog,
  verifyAttestationLog,
  summarizeAttestations,
  // Pipeline
  applyPrivacyPipeline,
  processMemoryPrivacy,
  validatePrivacy,
  defaultPrivacyConfig,
} from './privacy/index.js';
export type {
  PIIType,
  PIIMatch,
  PIIDetectionResult,
  PIIRedactionResult,
  RedactionMethod,
  DenyListRule,
  DenyListPolicy,
  DenyListEvaluation,
  DenyListAction,
  BuiltInRuleSet,
  EncryptedField,
  FieldEncryptionConfig,
  DeletionAttestation,
  DeletionAttestationLog,
  PrivacyConfig,
  PrivacyPipelineResult,
} from './privacy/index.js';

// Checkpoint System - Memory with Provenance
export {
  // Core services
  KnowledgeLane,
  CheckpointLedger,
  RestoreService,
  InMemoryCheckpointStorage,
  // Utilities
  calculateRecencyScore,
  calculateMemoryScore,
  computeCheckpointHash,
  verifyCheckpointIntegrity,
  verifyChainIntegrity,
  namespaceKey,
  DEFAULT_RANKING_WEIGHTS,
} from './checkpoint/index.js';
export type {
  // Namespace
  Namespace,
  // Checkpoints
  Checkpoint,
  CreateCheckpointInput,
  // Goals & Tasks
  Goal,
  Task,
  Action,
  // Memory
  MemoryObject,
  MemorySource,
  MemoryIngestionMetadata,
  ProvenanceEntry,
  CreateMemoryInput,
  // Retrieval
  MemoryQuery,
  RankingWeights,
  MemoryResult,
  // Retrieval Explainability (Issue #115)
  RetrievalExplanation,
  ScoreBreakdown,
  SourceTrace,
  PolicyPath,
  // Restore
  ResumePack,
  RestoreRationale,
  RestoreOptions,
  // Audit & Storage
  AuditEntry,
  CheckpointStorage,
  ListOptions,
} from './checkpoint/index.js';
