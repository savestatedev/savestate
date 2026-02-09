/**
 * Migration Wizard
 *
 * Platform-to-platform AI identity migration.
 * Extract → Transform → Load
 */

// Core types
export type {
  Platform,
  PlatformCapabilities,
  MigrationBundle,
  MigrationContents,
  MigrationState,
  MigrationPhase,
  MigrationOptions,
  MigrationCheckpoint,
  CompatibilityReport,
  CompatibilityItem,
  CompatibilityStatus,
  Extractor,
  ExtractOptions,
  Transformer,
  TransformOptions,
  Loader,
  LoadOptions,
  LoadResult,
} from './types.js';

// Orchestrator
export {
  MigrationOrchestrator,
  type MigrationEvent,
  type MigrationEventHandler,
  type RollbackAction,
  type RollbackPlan,
  type RollbackResult,
} from './orchestrator.js';

// Registries
export { getExtractor, registerExtractor, listExtractors, hasExtractor } from './extractors/registry.js';
export { getTransformer, registerTransformer, listTransformers, hasTransformer } from './transformers/registry.js';
export { getLoader, registerLoader, listLoaders, hasLoader } from './loaders/registry.js';

// Extractors (for direct instantiation with custom config)
export { ChatGPTExtractor, type ChatGPTExtractorConfig } from './extractors/chatgpt.js';

// Loaders (for direct instantiation with custom config)
export { ClaudeLoader, type ClaudeLoaderConfig } from './loaders/claude.js';

// Transformers (for direct instantiation)
export { ChatGPTToClaudeTransformer } from './transformers/chatgpt-to-claude.js';
export { ClaudeToChatGPTTransformer } from './transformers/claude-to-chatgpt.js';

// Transformation rules and utilities
export {
  // Types
  type ContentType,
  type OverflowStrategy,
  type AdaptationMethod,
  type TransformationRule,
  type RuleCondition,
  type TransformationResult,
  type CharacterLimit,
  type PlatformMapping,
  // Functions
  getTargetLimits,
  intelligentTruncate,
  splitContent,
  convertChatGPTInstructionsToClaude,
  convertClaudeInstructionsToChatGPT,
  convertMemoriesToDocument,
  convertDocumentToMemories,
  extractContextFromConversations,
  mapGPTToProject,
  validateBundleForTarget,
} from './transformers/rules.js';

// Platform capabilities (for compatibility checking)
export { getPlatformCapabilities, PLATFORM_CAPABILITIES } from './capabilities.js';
