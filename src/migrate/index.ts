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
export { MigrationOrchestrator, type MigrationEvent, type MigrationEventHandler } from './orchestrator.js';

// Registries
export { getExtractor, registerExtractor, listExtractors, hasExtractor } from './extractors/registry.js';
export { getTransformer, registerTransformer, listTransformers, hasTransformer } from './transformers/registry.js';
export { getLoader, registerLoader, listLoaders, hasLoader } from './loaders/registry.js';

// Platform capabilities (for compatibility checking)
export { getPlatformCapabilities, PLATFORM_CAPABILITIES } from './capabilities.js';
