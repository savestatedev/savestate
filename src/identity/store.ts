/**
 * Identity Storage (Issue #92)
 *
 * Handles loading, saving, and versioning of agent identity documents.
 * Identity documents are stored as identity/identity.json in SAF archives.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  AgentIdentity,
  validateIdentity,
  safeValidateIdentity,
  createIdentity,
  IDENTITY_SCHEMA_VERSION,
} from './schema.js';

/** Default identity filename within archives */
export const IDENTITY_FILENAME = 'identity/identity.json';

/** Local identity file path (workspace-relative) */
export const LOCAL_IDENTITY_PATH = '.savestate/identity.json';

/**
 * Identity version metadata for tracking changes.
 */
export interface IdentityVersion {
  /** Identity document version */
  version: string;
  /** Schema version used */
  schemaVersion: string;
  /** Timestamp of this version */
  timestamp: string;
  /** Hash of the identity content (for change detection) */
  contentHash?: string;
  /** Parent version (for version chain) */
  parentVersion?: string;
}

/**
 * Identity store result with metadata.
 */
export interface IdentityLoadResult {
  identity: AgentIdentity;
  source: 'archive' | 'local' | 'created';
  path?: string;
}

/**
 * Load identity from a file map (extracted SAF archive).
 *
 * @param files - Map of archive paths to content buffers
 * @returns AgentIdentity or undefined if not found
 */
export function loadIdentityFromArchive(
  files: Map<string, Buffer>,
): AgentIdentity | undefined {
  const buf = files.get(IDENTITY_FILENAME);
  if (!buf) {
    return undefined;
  }

  try {
    const data = JSON.parse(buf.toString('utf-8'));
    return validateIdentity(data);
  } catch {
    // Return undefined for invalid/malformed identity
    return undefined;
  }
}

/**
 * Store identity in a file map (for SAF archive packing).
 *
 * @param files - Map of archive paths to content buffers
 * @param identity - Identity document to store
 */
export function storeIdentityInArchive(
  files: Map<string, Buffer>,
  identity: AgentIdentity,
): void {
  const updated: AgentIdentity = {
    ...identity,
    updatedAt: new Date().toISOString(),
  };
  files.set(IDENTITY_FILENAME, Buffer.from(JSON.stringify(updated, null, 2)));
}

/**
 * Load identity from a local file path.
 *
 * @param path - Path to identity.json file
 * @returns AgentIdentity or undefined if not found/invalid
 */
export async function loadIdentityFromFile(
  path: string,
): Promise<AgentIdentity | undefined> {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return validateIdentity(data);
  } catch {
    return undefined;
  }
}

/**
 * Save identity to a local file path.
 *
 * @param path - Path to save identity.json
 * @param identity - Identity document to save
 */
export async function saveIdentityToFile(
  path: string,
  identity: AgentIdentity,
): Promise<void> {
  const updated: AgentIdentity = {
    ...identity,
    updatedAt: new Date().toISOString(),
  };

  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(path, JSON.stringify(updated, null, 2));
}

/**
 * Load identity from the workspace-local identity file.
 *
 * @param workspacePath - Workspace root directory
 * @returns IdentityLoadResult or undefined if not found
 */
export async function loadLocalIdentity(
  workspacePath: string = process.cwd(),
): Promise<IdentityLoadResult | undefined> {
  const localPath = join(workspacePath, LOCAL_IDENTITY_PATH);
  const identity = await loadIdentityFromFile(localPath);

  if (identity) {
    return {
      identity,
      source: 'local',
      path: localPath,
    };
  }

  return undefined;
}

/**
 * Save identity to the workspace-local identity file.
 *
 * @param identity - Identity document to save
 * @param workspacePath - Workspace root directory
 */
export async function saveLocalIdentity(
  identity: AgentIdentity,
  workspacePath: string = process.cwd(),
): Promise<string> {
  const localPath = join(workspacePath, LOCAL_IDENTITY_PATH);
  await saveIdentityToFile(localPath, identity);
  return localPath;
}

/**
 * Initialize a new identity document in the workspace.
 *
 * @param name - Agent name
 * @param workspacePath - Workspace root directory
 * @param overrides - Optional field overrides
 * @returns Created identity and path
 */
export async function initializeIdentity(
  name: string,
  workspacePath: string = process.cwd(),
  overrides?: Partial<AgentIdentity>,
): Promise<{ identity: AgentIdentity; path: string }> {
  const identity = createIdentity(name, overrides);
  const path = await saveLocalIdentity(identity, workspacePath);
  return { identity, path };
}

/**
 * Update a specific field in the local identity.
 *
 * @param field - Field name to update
 * @param value - New value (will be parsed if JSON-like)
 * @param workspacePath - Workspace root directory
 * @returns Updated identity
 */
export async function updateIdentityField(
  field: string,
  value: string,
  workspacePath: string = process.cwd(),
): Promise<AgentIdentity> {
  const result = await loadLocalIdentity(workspacePath);

  if (!result) {
    throw new Error(
      'No identity found. Run `savestate identity init <name>` first.',
    );
  }

  const identity = result.identity;

  // Parse value if it looks like JSON
  let parsedValue: unknown = value;
  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string if not valid JSON
    }
  }

  // Handle nested paths (e.g., "metadata.customField")
  if (field.includes('.')) {
    const parts = field.split('.');
    let current: Record<string, unknown> = identity as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = parsedValue;
  } else {
    // Direct field update
    (identity as Record<string, unknown>)[field] = parsedValue;
  }

  // Bump version if updating core fields
  const coreFields = [
    'name',
    'goals',
    'tone',
    'constraints',
    'tools',
    'persona',
    'instructions',
  ];
  if (coreFields.includes(field.split('.')[0])) {
    identity.version = bumpVersion(identity.version);
  }

  // Validate the updated identity
  const validation = safeValidateIdentity(identity);
  if (!validation.success) {
    throw new Error(
      `Invalid identity after update: ${validation.error?.message}`,
    );
  }

  await saveLocalIdentity(validation.data!, workspacePath);
  return validation.data!;
}

/**
 * Bump a semantic version string (increment patch).
 */
function bumpVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    parts[2]++;
    return parts.join('.');
  }
  return version;
}

/**
 * Compute a simple content hash for change detection.
 *
 * @param identity - Identity document
 * @returns Hex hash string
 */
export function computeIdentityHash(identity: AgentIdentity): string {
  const { createHash } = require('node:crypto');
  // Sort keys for deterministic hashing
  const content = JSON.stringify(identity, Object.keys(identity).sort());
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Compare two identity versions for changes.
 *
 * @param a - First identity
 * @param b - Second identity
 * @returns Whether the identities differ
 */
export function identitiesEqual(a: AgentIdentity, b: AgentIdentity): boolean {
  return computeIdentityHash(a) === computeIdentityHash(b);
}

/**
 * Get the current identity version info.
 *
 * @param identity - Identity document
 * @returns Version metadata
 */
export function getIdentityVersion(identity: AgentIdentity): IdentityVersion {
  return {
    version: identity.version,
    schemaVersion: identity.schemaVersion || IDENTITY_SCHEMA_VERSION,
    timestamp: identity.updatedAt || identity.createdAt || new Date().toISOString(),
    contentHash: computeIdentityHash(identity),
  };
}
