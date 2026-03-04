/**
 * Export/Import Operations for Portable Container
 * Issue #104: Core container operations
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { 
  SavestateContainer, 
  ContainerMetadata, 
  CONTAINER_FORMAT_VERSION,
  isValidContainer 
} from './format.js';
import { 
  AgentState, 
  validateAgentState, 
  migrateSchema,
  CURRENT_SCHEMA_VERSION 
} from './schema.js';
import { encrypt, decrypt, calculateChecksum, verifyChecksum } from './crypto.js';

export interface ExportOptions {
  agentId: string;
  passphrase: string;
  outputPath: string;
  description?: string;
  createdBy?: string;
}

export interface ImportOptions {
  filePath: string;
  passphrase: string;
  targetAgentId?: string;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  state?: AgentState;
  agentId?: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: ContainerMetadata;
}

/**
 * Export agent state to encrypted .savestate container
 */
export async function exportContainer(
  state: AgentState,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    // Validate state
    const validation = validateAgentState(state);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Invalid state: ${validation.errors?.join(', ')}` 
      };
    }

    // Serialize state to JSON
    const stateJson = JSON.stringify(state);

    // Encrypt
    const encryptedPayload = encrypt(stateJson, options.passphrase);

    // Calculate checksum
    const checksum = calculateChecksum(encryptedPayload);

    // Build metadata
    const now = new Date().toISOString();
    const metadata: ContainerMetadata = {
      agent_name: state.identity.name,
      schema_version: state.schema_version,
      created_by: options.createdBy || 'savestate-cli',
      created_at: now,
      description: options.description,
    };

    // Build container
    const container: SavestateContainer = {
      version: CONTAINER_FORMAT_VERSION,
      created_at: now,
      metadata,
      encrypted_payload: encryptedPayload,
      checksum,
    };

    // Write to file
    writeFileSync(options.outputPath, JSON.stringify(container, null, 2));

    return { success: true, path: options.outputPath };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Import agent state from encrypted .savestate container
 */
export async function importContainer(options: ImportOptions): Promise<ImportResult> {
  try {
    // Check file exists
    if (!existsSync(options.filePath)) {
      return { success: false, error: `File not found: ${options.filePath}` };
    }

    // Read and parse container
    const fileContent = readFileSync(options.filePath, 'utf8');
    let container: SavestateContainer;
    
    try {
      container = JSON.parse(fileContent);
    } catch {
      return { success: false, error: 'Invalid JSON in container file' };
    }

    // Validate container structure
    if (!isValidContainer(container)) {
      return { success: false, error: 'Invalid container structure' };
    }

    // Verify checksum
    if (!verifyChecksum(container.encrypted_payload, container.checksum)) {
      return { success: false, error: 'Checksum verification failed - file may be corrupted or tampered' };
    }

    // Decrypt
    let stateJson: string;
    try {
      stateJson = decrypt(container.encrypted_payload, options.passphrase);
    } catch {
      return { success: false, error: 'Decryption failed - incorrect passphrase' };
    }

    // Parse state
    let state: AgentState;
    try {
      state = JSON.parse(stateJson);
    } catch {
      return { success: false, error: 'Invalid state data after decryption' };
    }

    // Validate state
    const validation = validateAgentState(state);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Invalid state: ${validation.errors?.join(', ')}` 
      };
    }

    // Migrate schema if needed
    if (state.schema_version !== CURRENT_SCHEMA_VERSION) {
      state = migrateSchema(state, CURRENT_SCHEMA_VERSION);
    }

    return { 
      success: true, 
      state,
      agentId: options.targetAgentId || container.metadata.agent_name,
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Validate a container file without decrypting
 */
export function validateContainer(filePath: string): ValidationResult {
  const errors: string[] = [];

  // Check file exists
  if (!existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`] };
  }

  // Read and parse
  let container: SavestateContainer;
  try {
    const content = readFileSync(filePath, 'utf8');
    container = JSON.parse(content);
  } catch {
    return { valid: false, errors: ['Invalid JSON format'] };
  }

  // Validate structure
  if (!isValidContainer(container)) {
    errors.push('Invalid container structure');
  }

  // Check version compatibility
  if (container.version !== CONTAINER_FORMAT_VERSION) {
    errors.push(`Version mismatch: expected ${CONTAINER_FORMAT_VERSION}, got ${container.version}`);
  }

  // Verify checksum
  if (!verifyChecksum(container.encrypted_payload, container.checksum)) {
    errors.push('Checksum verification failed');
  }

  return {
    valid: errors.length === 0,
    errors,
    metadata: errors.length === 0 ? container.metadata : undefined,
  };
}

/**
 * Get container info without decrypting
 */
export function getContainerInfo(filePath: string): ContainerMetadata | null {
  try {
    const content = readFileSync(filePath, 'utf8');
    const container: SavestateContainer = JSON.parse(content);
    
    if (!isValidContainer(container)) {
      return null;
    }

    return container.metadata;
  } catch {
    return null;
  }
}
