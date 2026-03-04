/**
 * State Container - Portable, encrypted state container for AI agents
 * 
 * Provides a unified container for holding an AI's personality, memory,
 * conversation history, tools, and preferences.
 */

import { encrypt, decrypt, verify } from '../encryption.js';
import type { Identity, Memory, ConversationIndex, PlatformMeta, SnapshotChain } from '../types.js';

/**
 * State Container version
 */
export const STATE_CONTAINER_VERSION = '1.0.0';

/**
 * State Container schema
 */
export interface StateContainer {
  /** Container format version */
  version: string;
  /** Unique container identifier */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Container metadata */
  metadata: ContainerMetadata;
  /** AI Identity (personality, config, tools, skills) */
  identity: Identity;
  /** Memory (core memories, knowledge base) */
  memory: Memory;
  /** Conversation history index */
  conversations: ConversationIndex;
  /** Platform metadata */
  platform: PlatformMeta;
  /** Snapshot chain for incremental backups */
  chain?: SnapshotChain;
  /** Custom data */
  custom?: Record<string, unknown>;
}

/**
 * Container metadata
 */
export interface ContainerMetadata {
  /** Human-readable name */
  name?: string;
  /** Description */
  description?: string;
  /** Tags for organization */
  tags?: string[];
  /** Source platform */
  sourcePlatform: string;
  /** Target platforms (where this can be restored) */
  targetPlatforms: string[];
  /** Original container ID (if this is a derivative) */
  parentId?: string;
  /** Checksum (SHA-256) */
  checksum?: string;
}

/**
 * Encrypted State Container wrapper
 */
export interface EncryptedContainer {
  /** Magic bytes for identification */
  magic: string;
  /** Container format version */
  version: string;
  /** Encrypted container data (JSON stringified) */
  data: string;
  /** Encryption verification */
  checksum: string;
}

/**
 * Container options
 */
export interface ContainerOptions {
  /** Container name */
  name?: string;
  /** Description */
  description?: string;
  /** Tags */
  tags?: string[];
  /** Target platforms for portability */
  targetPlatforms?: string[];
}

/**
 * Create a state container
 */
export function createContainer(
  identity: Identity,
  memory: Memory,
  conversations: ConversationIndex,
  platform: PlatformMeta,
  options?: ContainerOptions
): StateContainer {
  const id = generateId();
  const timestamp = new Date().toISOString();

  return {
    version: STATE_CONTAINER_VERSION,
    id,
    timestamp,
    metadata: {
      name: options?.name,
      description: options?.description,
      tags: options?.tags,
      sourcePlatform: platform.name,
      targetPlatforms: options?.targetPlatforms || [platform.name],
    },
    identity,
    memory,
    conversations,
    platform,
  };
}

/**
 * Serialize a state container to JSON
 */
export function serializeContainer(container: StateContainer): string {
  return JSON.stringify(container, null, 2);
}

/**
 * Deserialize JSON to a state container
 */
export function deserializeContainer(data: string): StateContainer {
  const parsed = JSON.parse(data);
  
  // Validate required fields
  if (!parsed.version || !parsed.id || !parsed.timestamp) {
    throw new Error('Invalid container: missing required fields');
  }
  
  if (!parsed.identity || !parsed.memory || !parsed.conversations || !parsed.platform) {
    throw new Error('Invalid container: missing required sections');
  }
  
  return parsed as StateContainer;
}

/**
 * Encrypt a state container
 */
export async function encryptContainer(
  container: StateContainer,
  passphrase: string
): Promise<Buffer> {
  const json = serializeContainer(container);
  const data = Buffer.from(json, 'utf-8');
  return encrypt(data, passphrase);
}

/**
 * Decrypt a state container
 */
export async function decryptContainer(
  encrypted: Buffer,
  passphrase: string
): Promise<StateContainer> {
  const data = await decrypt(encrypted, passphrase);
  const json = data.toString('utf-8');
  return deserializeContainer(json);
}

/**
 * Verify container can be decrypted with passphrase
 */
export async function verifyContainer(
  encrypted: Buffer,
  passphrase: string
): Promise<boolean> {
  return verify(encrypted, passphrase);
}

/**
 * Create an encrypted container file
 */
export async function createEncryptedContainer(
  identity: Identity,
  memory: Memory,
  conversations: ConversationIndex,
  platform: PlatformMeta,
  passphrase: string,
  options?: ContainerOptions
): Promise<Buffer> {
  const container = createContainer(identity, memory, conversations, platform, options);
  return encryptContainer(container, passphrase);
}

/**
 * Load and decrypt a container from file
 */
export async function loadContainer(
  encrypted: Buffer,
  passphrase: string
): Promise<StateContainer> {
  return decryptContainer(encrypted, passphrase);
}

/**
 * Calculate checksum for container (SHA-256)
 */
export function calculateChecksum(container: StateContainer): string {
  const json = serializeContainer(container);
  // Simple hash for now - in production use crypto.subtle.digest
  return hashString(json);
}

/**
 * Simple string hash (non-cryptographic, for quick verification)
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex-like string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `sc_${timestamp}_${random}`;
}

/**
 * Validate container structure
 */
export function validateContainer(container: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!container || typeof container !== 'object') {
    return { valid: false, errors: ['Container must be an object'] };
  }
  
  const c = container as Record<string, unknown>;
  
  // Check version
  if (!c.version || typeof c.version !== 'string') {
    errors.push('Missing or invalid version');
  }
  
  // Check ID
  if (!c.id || typeof c.id !== 'string') {
    errors.push('Missing or invalid id');
  }
  
  // Check timestamp
  if (!c.timestamp || typeof c.timestamp !== 'string') {
    errors.push('Missing or invalid timestamp');
  }
  
  // Check required sections
  if (!c.identity) errors.push('Missing identity section');
  if (!c.memory) errors.push('Missing memory section');
  if (!c.conversations) errors.push('Missing conversations section');
  if (!c.platform) errors.push('Missing platform section');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migrate container to new version
 */
export function migrateContainer(
  container: StateContainer,
  targetVersion: string
): StateContainer {
  // Currently only one version exists
  if (targetVersion === STATE_CONTAINER_VERSION) {
    return container;
  }
  
  throw new Error(`Migration from ${container.version} to ${targetVersion} not supported`);
}

/**
 * Extract a subset of container data (for debugging/inspection)
 */
export function inspectContainer(container: StateContainer): {
  id: string;
  version: string;
  created: string;
  platform: string;
  memoryEntries: number;
  knowledgeDocs: number;
  conversations: number;
  tools: number;
  skills: number;
} {
  return {
    id: container.id,
    version: container.version,
    created: container.timestamp,
    platform: container.platform.name,
    memoryEntries: container.memory.core.length,
    knowledgeDocs: container.memory.knowledge.length,
    conversations: container.conversations.total,
    tools: container.identity.tools?.length || 0,
    skills: container.identity.skills?.length || 0,
  };
}

/**
 * Merge two containers (for incremental backups)
 */
export function mergeContainers(
  base: StateContainer,
  update: StateContainer
): StateContainer {
  // Verify they're related
  if (base.id !== update.parentId && update.metadata.parentId !== base.id) {
    throw new Error('Containers are not related - cannot merge');
  }
  
  return {
    ...update,
    chain: {
      current: update.id,
      parent: base.id,
      ancestors: [...(base.chain?.ancestors || []), base.id],
    },
  };
}

export default {
  STATE_CONTAINER_VERSION,
  createContainer,
  serializeContainer,
  deserializeContainer,
  encryptContainer,
  decryptContainer,
  verifyContainer,
  createEncryptedContainer,
  loadContainer,
  validateContainer,
  migrateContainer,
  inspectContainer,
  mergeContainers,
};
