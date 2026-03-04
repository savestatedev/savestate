/**
 * Migration Wizard Types
 *
 * Defines the core types for the three-phase migration architecture:
 * Extract → Transform → Load
 */

// ─── Platforms ───────────────────────────────────────────────

export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'copilot';

export interface PlatformCapabilities {
  /** Platform identifier */
  id: Platform;
  /** Human-readable name */
  name: string;
  /** Max characters for system instructions */
  instructionLimit: number;
  /** Supports explicit memory entries */
  hasMemory: boolean;
  /** Max memory entries (if applicable) */
  memoryLimit?: number;
  /** Supports file uploads */
  hasFiles: boolean;
  /** Max file size in bytes */
  fileSizeLimit?: number;
  /** Supports project/workspace organization */
  hasProjects: boolean;
  /** Supports conversation history export */
  hasConversations: boolean;
  /** Supports custom bots/GPTs */
  hasCustomBots: boolean;
}

// ─── Migration Bundle ────────────────────────────────────────

/**
 * SaveState Migration Bundle (.smb)
 *
 * Standardized intermediate format for platform-agnostic data transfer.
 * This is what extractors produce and loaders consume.
 */
export interface MigrationBundle {
  /** Bundle format version */
  version: '1.0';
  /** Unique bundle identifier */
  id: string;
  /** Source platform info */
  source: {
    platform: Platform;
    extractedAt: string;
    accountId?: string;
    extractorVersion: string;
    /** Path to the bundle directory (set during extraction) */
    bundlePath?: string;
  };
  /** Target platform (set during transform phase) */
  target?: {
    platform: Platform;
    transformedAt: string;
    transformerVersion: string;
  };
  /** Extracted/transformed content */
  contents: MigrationContents;
  /** Metadata about the migration */
  metadata: MigrationMetadata;
}

export interface MigrationContents {
  /** System instructions / custom instructions / personality */
  instructions?: InstructionData;
  /** Memory entries (explicit memories) */
  memories?: MemoryData;
  /** Conversation history */
  conversations?: ConversationData;
  /** Uploaded files */
  files?: FileData;
  /** Custom bots / GPTs / Projects */
  customBots?: CustomBotData;
  /** Platform-specific extras */
  extras?: Record<string, unknown>;
}

export interface InstructionData {
  /** Raw instruction text */
  content: string;
  /** Character count */
  length: number;
  /** Sections parsed from the content */
  sections?: InstructionSection[];
}

export interface InstructionSection {
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MemoryData {
  /** Memory entries */
  entries: MemoryEntry[];
  /** Total count */
  count: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  category?: string;
  source?: string;
}

export interface ConversationData {
  /** Path to conversations directory in bundle */
  path: string;
  /** Number of conversations */
  count: number;
  /** Total messages across all conversations */
  messageCount: number;
  /** Conversation summaries */
  summaries?: ConversationSummary[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Key topics/decisions from this conversation */
  keyPoints?: string[];
}

export interface FileData {
  /** Files in the bundle */
  files: FileEntry[];
  /** Total count */
  count: number;
  /** Total size in bytes */
  totalSize: number;
}

export interface FileEntry {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Path within the bundle */
  path: string;
  /** Original upload date */
  uploadedAt?: string;
}

export interface CustomBotData {
  /** Custom bots/GPTs */
  bots: CustomBotEntry[];
  count: number;
}

export interface CustomBotEntry {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  /** Attached knowledge files */
  knowledgeFiles?: string[];
  /** Enabled capabilities */
  capabilities?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface MigrationMetadata {
  /** Total items extracted */
  totalItems: number;
  /** Breakdown by type */
  itemCounts: {
    instructions: number;
    memories: number;
    conversations: number;
    files: number;
    customBots: number;
  };
  /** Warnings during extraction */
  warnings: string[];
  /** Errors (non-fatal) during extraction */
  errors: string[];
}

// ─── Migration State ─────────────────────────────────────────

export type MigrationPhase = 'pending' | 'extracting' | 'transforming' | 'loading' | 'complete' | 'failed';

export interface MigrationState {
  /** Unique migration ID */
  id: string;
  /** Current phase */
  phase: MigrationPhase;
  /** Source platform */
  source: Platform;
  /** Target platform */
  target: Platform;
  /** When migration started */
  startedAt: string;
  /** When current phase started */
  phaseStartedAt: string;
  /** When migration completed (if applicable) */
  completedAt?: string;
  /** Path to migration bundle */
  bundlePath?: string;
  /** Checkpoints for resume capability */
  checkpoints: MigrationCheckpoint[];
  /** Current progress (0-100) */
  progress: number;
  /** Error if failed */
  error?: string;
  /** Options used for this migration */
  options: MigrationOptions;
}

export interface MigrationCheckpoint {
  /** Phase this checkpoint was taken after */
  phase: MigrationPhase;
  /** Timestamp */
  timestamp: string;
  /** Path to checkpoint data */
  dataPath: string;
  /** Checksum for integrity */
  checksum: string;
}

export interface MigrationOptions {
  /** Only include specific content types */
  include?: ('instructions' | 'memories' | 'conversations' | 'files' | 'customBots')[];
  /** Exclude specific content types */
  exclude?: ('instructions' | 'memories' | 'conversations' | 'files' | 'customBots')[];
  /** Dry run (don't actually load to target) */
  dryRun?: boolean;
  /** Skip confirmation prompts */
  force?: boolean;
  /** Working directory for bundle storage */
  workDir?: string;
}

// ─── Compatibility ───────────────────────────────────────────

export type CompatibilityStatus = 'perfect' | 'adapted' | 'incompatible';

export interface CompatibilityItem {
  /** What this item is */
  type: 'instructions' | 'memory' | 'conversation' | 'file' | 'customBot' | 'feature';
  /** Human-readable name */
  name: string;
  /** Compatibility status */
  status: CompatibilityStatus;
  /** Explanation */
  reason: string;
  /** Suggested action if not perfect */
  action?: string;
  /** Original data reference */
  sourceRef?: string;
}

export interface CompatibilityReport {
  /** Source platform */
  source: Platform;
  /** Target platform */
  target: Platform;
  /** Generated at */
  generatedAt: string;
  /** Summary counts */
  summary: {
    perfect: number;
    adapted: number;
    incompatible: number;
    total: number;
  };
  /** Detailed items */
  items: CompatibilityItem[];
  /** Recommendations */
  recommendations: string[];
  /** Overall migration feasibility */
  feasibility: 'easy' | 'moderate' | 'complex' | 'partial';
}

// ─── Plugin Interfaces ───────────────────────────────────────

/**
 * Extractor Plugin Interface
 *
 * Extractors pull data from a source platform and produce a MigrationBundle.
 */
export interface Extractor {
  /** Platform this extractor handles */
  readonly platform: Platform;
  /** Extractor version */
  readonly version: string;

  /** Check if we can extract from this platform (auth, etc.) */
  canExtract(): Promise<boolean>;

  /** Extract all data from the platform */
  extract(options: ExtractOptions): Promise<MigrationBundle>;

  /** Get progress during extraction (0-100) */
  getProgress(): number;
}

export interface ExtractOptions {
  /** Only include specific content types */
  include?: ('instructions' | 'memories' | 'conversations' | 'files' | 'customBots')[];
  /** Progress callback */
  onProgress?: (progress: number, message: string) => void;
  /** Working directory for temp files */
  workDir: string;
}

/**
 * Transformer Plugin Interface
 *
 * Transformers convert a MigrationBundle from one platform format to another.
 */
export interface Transformer {
  /** Source platform */
  readonly source: Platform;
  /** Target platform */
  readonly target: Platform;
  /** Transformer version */
  readonly version: string;

  /** Generate compatibility report without transforming */
  analyze(bundle: MigrationBundle): Promise<CompatibilityReport>;

  /** Transform the bundle for the target platform */
  transform(bundle: MigrationBundle, options: TransformOptions): Promise<MigrationBundle>;
}

export interface TransformOptions {
  /** How to handle content exceeding limits */
  overflowStrategy: 'truncate' | 'summarize' | 'split' | 'error';
  /** Progress callback */
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Loader Plugin Interface
 *
 * Loaders push a MigrationBundle to a target platform.
 */
export interface Loader {
  /** Platform this loader handles */
  readonly platform: Platform;
  /** Loader version */
  readonly version: string;

  /** Check if we can load to this platform (auth, etc.) */
  canLoad(): Promise<boolean>;

  /** Load the bundle to the target platform */
  load(bundle: MigrationBundle, options: LoadOptions): Promise<LoadResult>;

  /** Get progress during loading (0-100) */
  getProgress(): number;
}

export interface LoadOptions {
  /** Dry run (validate but don't write) */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, message: string) => void;
  /** Name for the created project/workspace */
  projectName?: string;
}

export interface LoadResult {
  /** Whether load succeeded */
  success: boolean;
  /** Items successfully loaded */
  loaded: {
    instructions: boolean;
    memories: number;
    files: number;
    customBots: number;
  };
  /** Reference to created resources */
  created?: {
    projectId?: string;
    projectUrl?: string;
  };
  /** Warnings during load */
  warnings: string[];
  /** Errors during load */
  errors: string[];
  /** Manual steps required (if any) */
  manualSteps?: string[];
}
