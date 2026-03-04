/**
 * State Container Module
 *
 * Portable, encrypted, cross-platform state container for AI agents.
 * Enables identity preservation across different LLM providers.
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

/**
 * Container version for compatibility
 */
export const CONTAINER_VERSION = '1.0.0';

/**
 * AI Agent personality configuration
 */
export interface AgentPersonality {
  /** Display name for the agent */
  name: string;

  /** Role/description */
  role: string;

  /** Core traits/characteristics */
  traits: string[];

  /** Communication style */
  communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';

  /** Custom instructions */
  customInstructions?: string;
}

/**
 * Tool definition for agent tools
 */
export interface AgentTool {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Function definition */
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };

  /** Whether tool is enabled */
  enabled: boolean;
}

/**
 * Agent preferences
 */
export interface AgentPreferences {
  /** Preferred language */
  language?: string;

  /** Timezone */
  timezone?: string;

  /** Response format */
  responseFormat?: 'json' | 'markdown' | 'text';

  /** Temperature setting */
  temperature?: number;

  /** Max tokens */
  maxTokens?: number;

  /** Custom preferences */
  [key: string]: unknown;
}

/**
 * Container metadata
 */
export interface ContainerMetadata {
  /** Container version */
  version: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last modified */
  modifiedAt: string;

  /** Memory reference (snapshot ID) */
  memoryRef?: string;

  /** Source platform */
  sourcePlatform?: string;

  /** Target platform */
  targetPlatform?: string;

  /** Custom tags */
  tags?: string[];
}

/**
 * State container contents (before encryption)
 */
export interface StateContainerContents {
  /** Container metadata */
  metadata: ContainerMetadata;

  /** Agent personality */
  personality: AgentPersonality;

  /** Agent memory reference (optional - could be a snapshot ID) */
  memoryRef?: string;

  /** Conversation history (recent, for context) */
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;

  /** Agent tools */
  tools: AgentTool[];

  /** Agent preferences */
  preferences: AgentPreferences;

  /** Custom data */
  customData?: Record<string, unknown>;
}

/**
 * Encrypted container structure
 */
export interface EncryptedContainer {
  /** Container version */
  version: string;

  /** Encryption algorithm */
  algorithm: 'aes-256-gcm';

  /** Initialization vector */
  iv: string;

  /** Authentication tag */
  authTag: string;

  /** Salt for key derivation */
  salt: string;

  /** Encrypted payload (base64) */
  payload: string;

  /** Metadata (unencrypted) */
  metadata: ContainerMetadata;
}

/**
 * Serialized container (can be file content)
 */
export interface SerializedContainer {
  /** Version */
  version: string;

  /** Whether encrypted */
  encrypted: boolean;

  /** Container data */
  data: string;

  /** Metadata */
  metadata: ContainerMetadata;
}

/**
 * State container configuration
 */
export interface StateContainerConfig {
  /** Encryption enabled */
  encrypt: boolean;

  /** Passphrase for encryption */
  passphrase?: string;

  /** Source platform */
  sourcePlatform?: string;

  /** Target platform */
  targetPlatform?: string;
}

/**
 * StateContainer - portable, encrypted container for AI agent state
 */
export class StateContainer {
  private contents: StateContainerContents;
  private config: StateContainerConfig;
  private encrypted: boolean = false;
  private encryptedData?: EncryptedContainer;

  constructor(config: Partial<StateContainerConfig> = {}) {
    this.config = {
      encrypt: config.encrypt ?? true,
      passphrase: config.passphrase,
      sourcePlatform: config.sourcePlatform,
      targetPlatform: config.targetPlatform,
    };

    // Initialize with default contents
    this.contents = this.createEmptyContents();
  }

  /**
   * Create empty contents structure
   */
  private createEmptyContents(): StateContainerContents {
    return {
      metadata: {
        version: CONTAINER_VERSION,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        sourcePlatform: this.config.sourcePlatform,
        targetPlatform: this.config.targetPlatform,
      },
      personality: {
        name: 'Unnamed Agent',
        role: 'AI Assistant',
        traits: [],
        communicationStyle: 'casual',
      },
      tools: [],
      preferences: {},
    };
  }

  /**
   * Derive encryption key from passphrase
   */
  private deriveKey(passphrase: string, salt: Buffer): Buffer {
    return scryptSync(passphrase, salt, 32);
  }

  /**
   * Encrypt contents
   */
  private encryptContents(): EncryptedContainer {
    if (!this.config.passphrase) {
      throw new Error('Passphrase required for encryption');
    }

    const salt = randomBytes(16);
    const key = this.deriveKey(this.config.passphrase, salt);
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(this.contents);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      version: CONTAINER_VERSION,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
      payload: encrypted.toString('base64'),
      metadata: this.contents.metadata,
    };
  }

  /**
   * Decrypt contents
   */
  private decryptContents(container: EncryptedContainer): StateContainerContents {
    if (!this.config.passphrase) {
      throw new Error('Passphrase required for decryption');
    }

    const salt = Buffer.from(container.salt, 'base64');
    const key = this.deriveKey(this.config.passphrase, salt);
    const iv = Buffer.from(container.iv, 'base64');
    const authTag = Buffer.from(container.authTag, 'base64');
    const payload = Buffer.from(container.payload, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(payload),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  // ============ Public API ============

  /**
   * Set agent personality
   */
  setPersonality(personality: Partial<AgentPersonality>): void {
    this.contents.personality = {
      ...this.contents.personality,
      ...personality,
    };
    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Get agent personality
   */
  getPersonality(): AgentPersonality {
    return { ...this.contents.personality };
  }

  /**
   * Add a tool
   */
  addTool(tool: AgentTool): void {
    this.contents.tools.push(tool);
    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Remove a tool
   */
  removeTool(name: string): void {
    this.contents.tools = this.contents.tools.filter(t => t.name !== name);
    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Get tools
   */
  getTools(): AgentTool[] {
    return [...this.contents.tools];
  }

  /**
   * Set preferences
   */
  setPreferences(preferences: Partial<AgentPreferences>): void {
    this.contents.preferences = {
      ...this.contents.preferences,
      ...preferences,
    };
    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Get preferences
   */
  getPreferences(): AgentPreferences {
    return { ...this.contents.preferences };
  }

  /**
   * Set memory reference
   */
  setMemoryRef(ref: string): void {
    this.contents.memoryRef = ref;
    this.contents.metadata.memoryRef = ref;
    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Get memory reference
   */
  getMemoryRef(): string | undefined {
    return this.contents.memoryRef;
  }

  /**
   * Add conversation message
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    if (!this.contents.conversationHistory) {
      this.contents.conversationHistory = [];
    }
    this.contents.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 messages
    if (this.contents.conversationHistory.length > 100) {
      this.contents.conversationHistory = this.contents.conversationHistory.slice(-100);
    }

    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Array<{ role: string; content: string; timestamp: string }> {
    return this.contents.conversationHistory ? [...this.contents.conversationHistory] : [];
  }

  /**
   * Set custom data
   */
  setCustomData(key: string, value: unknown): void {
    if (!this.contents.customData) {
      this.contents.customData = {};
    }
    this.contents.customData[key] = value;
    this.contents.metadata.modifiedAt = new Date().toISOString();
  }

  /**
   * Get custom data
   */
  getCustomData(key: string): unknown {
    return this.contents.customData?.[key];
  }

  /**
   * Serialize container
   */
  serialize(): SerializedContainer {
    let data: string;

    if (this.config.encrypt && this.config.passphrase) {
      const encrypted = this.encryptContents();
      this.encryptedData = encrypted;
      this.encrypted = true;
      data = JSON.stringify(encrypted);
    } else {
      data = JSON.stringify(this.contents);
      this.encrypted = false;
    }

    return {
      version: CONTAINER_VERSION,
      encrypted: this.encrypted,
      data,
      metadata: this.contents.metadata,
    };
  }

  /**
   * Deserialize container
   */
  static deserialize(serialized: SerializedContainer, passphrase?: string): StateContainer {
    const container = new StateContainer({ passphrase });

    if (serialized.encrypted) {
      const encrypted = JSON.parse(serialized.data) as EncryptedContainer;
      container.encryptedData = encrypted;
      container.encrypted = true;
      container.contents = container.decryptContents(encrypted);
    } else {
      container.contents = JSON.parse(serialized.data);
    }

    return container;
  }

  /**
   * Export to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.serialize(), null, 2);
  }

  /**
   * Import from JSON string
   */
  static fromJSON(json: string, passphrase?: string): StateContainer {
    const serialized = JSON.parse(json) as SerializedContainer;
    return StateContainer.deserialize(serialized, passphrase);
  }

  /**
   * Get metadata
   */
  getMetadata(): ContainerMetadata {
    return {
      ...this.contents.metadata,
      // Include memoryRef from contents if present
      ...(this.contents.memoryRef && { memoryRef: this.contents.memoryRef }),
    };
  }

  /**
   * Check if container is encrypted
   */
  isEncrypted(): boolean {
    return this.encrypted;
  }

  /**
   * Get full contents (if not encrypted)
   */
  getContents(): StateContainerContents {
    if (this.encrypted) {
      throw new Error('Cannot get contents of encrypted container. Decrypt first.');
    }
    return JSON.parse(JSON.stringify(this.contents));
  }
}

// ============ Functional API (for compatibility with tests) ============

import type { Identity, Memory, ConversationIndex, PlatformMeta } from '../types.js';
import { encrypt, decrypt, verify } from '../encryption.js';

/**
 * Functional API version constant
 */
export const STATE_CONTAINER_VERSION = '1.0.0';

/**
 * Container metadata (functional API)
 */
export interface FunctionalContainerMetadata {
  name?: string;
  description?: string;
  tags?: string[];
  targetPlatforms?: string[];
  parentId?: string;
}

/**
 * Full container structure (functional API)
 */
export interface Container {
  /** Unique container ID */
  id: string;

  /** Container version */
  version: string;

  /** Creation timestamp */
  timestamp: string;

  /** Identity data */
  identity: Identity;

  /** Memory data */
  memory: Memory;

  /** Conversation index */
  conversations: ConversationIndex;

  /** Platform metadata */
  platform: PlatformMeta;

  /** Container metadata */
  metadata: FunctionalContainerMetadata;
}

/**
 * Options for creating a container
 */
export interface ContainerOptions {
  /** Container name */
  name?: string;

  /** Container description */
  description?: string;

  /** Container tags */
  tags?: string[];

  /** Target platforms */
  targetPlatforms?: string[];
}

/**
 * Create a new state container
 */
export function createContainer(
  identity: Identity,
  memory: Memory,
  conversations: ConversationIndex,
  platform: PlatformMeta,
  options: ContainerOptions = {}
): Container {
  const id = `sc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    version: STATE_CONTAINER_VERSION,
    timestamp: new Date().toISOString(),
    identity,
    memory,
    conversations,
    platform,
    metadata: {
      name: options.name,
      description: options.description,
      tags: options.tags,
      targetPlatforms: options.targetPlatforms ?? [platform.name],
    },
  };
}

/**
 * Serialize a container to JSON string
 */
export function serializeContainer(container: Container): string {
  return JSON.stringify(container, null, 2);
}

/**
 * Deserialize a container from JSON string
 */
export function deserializeContainer(json: string): Container {
  try {
    const parsed = JSON.parse(json) as Container;

    // Validate required fields
    if (!parsed.id || !parsed.version || !parsed.timestamp) {
      throw new Error('Invalid container: missing required fields');
    }
    if (!parsed.identity || !parsed.memory || !parsed.conversations || !parsed.platform) {
      throw new Error('Invalid container: missing required sections');
    }

    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Invalid JSON format');
    }
    throw err;
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a container structure
 */
export function validateContainer(container: unknown): ValidationResult {
  const errors: string[] = [];

  if (!container || typeof container !== 'object') {
    return { valid: false, errors: ['Container must be an object'] };
  }

  const c = container as Record<string, unknown>;

  if (!c.id || typeof c.id !== 'string') {
    errors.push('Missing or invalid id');
  }
  if (!c.version || typeof c.version !== 'string') {
    errors.push('Missing or invalid version');
  }
  if (!c.timestamp || typeof c.timestamp !== 'string') {
    errors.push('Missing or invalid timestamp');
  }
  if (!c.identity) {
    errors.push('Missing identity section');
  }
  if (!c.memory) {
    errors.push('Missing memory section');
  }
  if (!c.conversations) {
    errors.push('Missing conversations section');
  }
  if (!c.platform) {
    errors.push('Missing platform section');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Container inspection result
 */
export interface ContainerInspectResult {
  id: string;
  version: string;
  platform: string;
  timestamp: string;
  memoryEntries: number;
  knowledgeDocs: number;
  conversations: number;
  tools: number;
  skills: number;
}

/**
 * Inspect a container and return summary information
 */
export function inspectContainer(container: Container): ContainerInspectResult {
  const memoryEntries = container.memory?.core?.length ?? 0;
  const knowledgeDocs = container.memory?.knowledge?.length ?? 0;
  const conversations = container.conversations?.conversations?.length ?? 0;
  const tools = container.identity?.tools?.length ?? 0;
  const skills = container.identity?.skills?.length ?? 0;

  return {
    id: container.id,
    version: container.version,
    platform: container.platform?.name ?? 'unknown',
    timestamp: container.timestamp,
    memoryEntries,
    knowledgeDocs,
    conversations,
    tools,
    skills,
  };
}

export default StateContainer;
