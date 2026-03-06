/**
 * Portable Encrypted State Container Format
 * Issue #104: Cross-platform AI agent state portability
 */

export const CONTAINER_FORMAT_VERSION = '1.0.0';
export const CONTAINER_FILE_EXTENSION = '.savestate';

/**
 * Metadata stored in plaintext (visible without decryption)
 */
export interface ContainerMetadata {
  agent_name: string;
  schema_version: string;
  created_by: string;
  created_at: string;
  description?: string;
}

/**
 * The encrypted payload structure (after decryption)
 */
export interface EncryptedPayload {
  salt: string;      // Base64 encoded salt for key derivation
  iv: string;        // Base64 encoded initialization vector
  ciphertext: string; // Base64 encoded encrypted data
  authTag: string;   // Base64 encoded authentication tag
}

/**
 * The complete .savestate container format
 */
export interface SavestateContainer {
  version: string;
  created_at: string;
  metadata: ContainerMetadata;
  encrypted_payload: EncryptedPayload;
  checksum: string;  // SHA-256 hash of the encrypted payload
}

/**
 * Validate that an object conforms to the SavestateContainer structure
 */
export function isValidContainer(obj: unknown): obj is SavestateContainer {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const container = obj as SavestateContainer;
  
  return (
    typeof container.version === 'string' &&
    typeof container.created_at === 'string' &&
    typeof container.checksum === 'string' &&
    isValidMetadata(container.metadata) &&
    isValidEncryptedPayload(container.encrypted_payload)
  );
}

function isValidMetadata(obj: unknown): obj is ContainerMetadata {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const meta = obj as ContainerMetadata;
  
  return (
    typeof meta.agent_name === 'string' &&
    typeof meta.schema_version === 'string' &&
    typeof meta.created_by === 'string' &&
    typeof meta.created_at === 'string'
  );
}

function isValidEncryptedPayload(obj: unknown): obj is EncryptedPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const payload = obj as EncryptedPayload;
  
  return (
    typeof payload.salt === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.authTag === 'string'
  );
}
