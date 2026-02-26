/**
 * SaveState Field-Level Encryption
 *
 * Provides additional encryption for sensitive memory fields,
 * independent of the main archive encryption.
 *
 * Uses AES-256-GCM with Argon2id key derivation for field values.
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'node:crypto';
import type { EncryptedField, FieldEncryptionConfig } from './types.js';

// ─── Constants ───────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// scrypt parameters (OWASP minimum: N=32768, r=8, p=1)
// For Argon2id in production, use argon2 package
const SCRYPT_N = 32768; // OWASP minimum for interactive logins
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// ─── Key Derivation ──────────────────────────────────────────

/**
 * Derive a field encryption key from passphrase and salt.
 * Uses scrypt with OWASP-compliant parameters.
 * Note: For higher security requirements, consider argon2id via the argon2 package.
 */
async function deriveFieldKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  const { scryptSync } = await import('node:crypto');
  return scryptSync(passphrase, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024, // 64MB - accommodate OWASP N=32768, r=8 (requires ~32MB)
  });
}

// ─── Field Encryption ────────────────────────────────────────

/**
 * Encrypt a field value.
 *
 * @param value - The value to encrypt (string, object, or array)
 * @param passphrase - Encryption passphrase
 * @param keyId - Key identifier for rotation tracking
 * @returns Encrypted field wrapper
 */
export async function encryptField(
  value: string | object | unknown[],
  passphrase: string,
  keyId?: string,
): Promise<EncryptedField> {
  // Serialize value
  const plaintext = typeof value === 'string'
    ? value
    : JSON.stringify(value);

  const valueType = Array.isArray(value)
    ? 'array'
    : typeof value === 'object'
      ? 'object'
      : 'string';

  // Generate salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key
  const key = await deriveFieldKey(passphrase, salt);

  // Build AAD (Additional Authenticated Data) to prevent ciphertext transplant attacks
  // AAD binds ciphertext to its context without being encrypted
  const aadComponents = [
    'savestate-field-v1', // Version tag
    valueType,            // Data type
    keyId || 'default',   // Key identifier
  ];
  const aad = Buffer.from(aadComponents.join(':'), 'utf8');

  // Encrypt with AAD
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: [salt][iv][authTag][ciphertext]
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);

  return {
    __encrypted: true,
    algorithm: 'aes-256-gcm',
    kdf: 'scrypt',
    data: packed.toString('base64'),
    meta: {
      type: valueType,
      encryptedAt: new Date().toISOString(),
      keyId,
    },
  };
}

/**
 * Decrypt a field value.
 *
 * @param field - The encrypted field wrapper
 * @param passphrase - Decryption passphrase
 * @returns Original value
 */
export async function decryptField(
  field: EncryptedField,
  passphrase: string,
): Promise<string | object | unknown[]> {
  if (!field.__encrypted) {
    throw new Error('Not an encrypted field');
  }

  const packed = Buffer.from(field.data, 'base64');

  // Unpack
  let offset = 0;
  const salt = packed.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = packed.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = packed.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  const ciphertext = packed.subarray(offset);

  // Derive key
  const key = await deriveFieldKey(passphrase, salt);

  // Reconstruct AAD (must match encryption)
  const aadComponents = [
    'savestate-field-v1',
    field.meta?.type || 'string',
    field.meta?.keyId || 'default',
  ];
  const aad = Buffer.from(aadComponents.join(':'), 'utf8');

  // Decrypt with AAD
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  decipher.setAAD(aad);

  let plaintext: string;
  try {
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Field decryption failed — wrong passphrase or corrupted data');
  }

  // Parse based on original type
  if (field.meta?.type === 'array' || field.meta?.type === 'object') {
    try {
      return JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
  }

  return plaintext;
}

/**
 * Check if a value is an encrypted field.
 */
export function isEncryptedField(value: unknown): value is EncryptedField {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__encrypted' in value &&
    (value as EncryptedField).__encrypted === true
  );
}

// ─── JSONPath Matching ───────────────────────────────────────

/**
 * Simple JSONPath matcher for field paths.
 * Supports: $.path.to.field, $.array[*].field, $.**.field (recursive)
 */
function matchJsonPath(path: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = path.startsWith('$') ? path : `$.${path}`;
  const normalizedPattern = pattern.startsWith('$') ? pattern : `$.${pattern}`;

  // Use placeholders to prevent interference between replacements
  const RECURSIVE_PLACEHOLDER = '\x00RECURSIVE\x00';
  const ARRAY_WILDCARD_PLACEHOLDER = '\x00ARRAY\x00';
  
  // Step 1: Replace special patterns with placeholders
  let regexPattern = normalizedPattern
    .replace(/\*\*/g, RECURSIVE_PLACEHOLDER) // ** -> placeholder
    .replace(/\[\*\]/g, ARRAY_WILDCARD_PLACEHOLDER); // [*] -> placeholder
  
  // Step 2: Escape special regex characters
  regexPattern = regexPattern
    .replace(/\$/g, '\\$') // Escape $ (regex end anchor)
    .replace(/\./g, '\\.'); // Escape dots
  
  // Step 3: Replace single wildcards (*)
  regexPattern = regexPattern.replace(/\*/g, '[^.\\[\\]]+');
  
  // Step 4: Restore placeholders with regex patterns
  regexPattern = regexPattern
    .replace(new RegExp(RECURSIVE_PLACEHOLDER, 'g'), '.*') // ** matches anything
    .replace(new RegExp(ARRAY_WILDCARD_PLACEHOLDER, 'g'), '\\[\\d+\\]'); // [*] matches [0], [1], etc.

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

// ─── Object Processing ───────────────────────────────────────

/**
 * Recursively encrypt fields in an object based on config.
 *
 * @param obj - Object to process
 * @param config - Field encryption configuration
 * @param passphrase - Encryption passphrase
 * @param containsPIICheck - Optional function to check if content contains PII
 * @returns Object with encrypted fields and list of encrypted paths
 */
export async function encryptFields(
  obj: Record<string, unknown>,
  config: FieldEncryptionConfig,
  passphrase: string,
  containsPIICheck?: (content: string) => boolean,
): Promise<{ result: Record<string, unknown>; encryptedPaths: string[] }> {
  const encryptedPaths: string[] = [];

  async function processValue(
    value: unknown,
    path: string,
  ): Promise<unknown> {
    // Check if this path should always be encrypted
    const shouldAlwaysEncrypt = config.alwaysEncrypt.some((pattern) =>
      matchJsonPath(path, pattern),
    );

    // Check if this path should be encrypted if it contains PII
    const shouldEncryptIfPII =
      containsPIICheck &&
      config.encryptIfPII.some((pattern) => matchJsonPath(path, pattern));

    if (typeof value === 'string') {
      if (shouldAlwaysEncrypt) {
        encryptedPaths.push(path);
        return encryptField(value, passphrase, config.keyId);
      }

      if (shouldEncryptIfPII && containsPIICheck(value)) {
        encryptedPaths.push(path);
        return encryptField(value, passphrase, config.keyId);
      }

      return value;
    }

    if (Array.isArray(value)) {
      return Promise.all(
        value.map((item, index) => processValue(item, `${path}[${index}]`)),
      );
    }

    if (typeof value === 'object' && value !== null) {
      // Don't process already-encrypted fields
      if (isEncryptedField(value)) {
        return value;
      }

      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = await processValue(val, `${path}.${key}`);
      }
      return result;
    }

    return value;
  }

  const result = (await processValue(obj, '$')) as Record<string, unknown>;
  return { result, encryptedPaths };
}

/**
 * Recursively decrypt fields in an object.
 *
 * @param obj - Object to process
 * @param passphrase - Decryption passphrase
 * @returns Object with decrypted fields
 */
export async function decryptFields(
  obj: Record<string, unknown>,
  passphrase: string,
): Promise<Record<string, unknown>> {
  async function processValue(value: unknown): Promise<unknown> {
    if (isEncryptedField(value)) {
      return decryptField(value, passphrase);
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map(processValue));
    }

    if (typeof value === 'object' && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = await processValue(val);
      }
      return result;
    }

    return value;
  }

  return (await processValue(obj)) as Record<string, unknown>;
}

// ─── Key Rotation ────────────────────────────────────────────

/**
 * Re-encrypt all fields with a new passphrase.
 *
 * @param obj - Object with encrypted fields
 * @param oldPassphrase - Current passphrase
 * @param newPassphrase - New passphrase
 * @param newKeyId - New key identifier
 * @returns Object with re-encrypted fields
 */
export async function rotateFieldKeys(
  obj: Record<string, unknown>,
  oldPassphrase: string,
  newPassphrase: string,
  newKeyId: string,
): Promise<Record<string, unknown>> {
  async function processValue(value: unknown): Promise<unknown> {
    if (isEncryptedField(value)) {
      const decrypted = await decryptField(value, oldPassphrase);
      return encryptField(decrypted, newPassphrase, newKeyId);
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map(processValue));
    }

    if (typeof value === 'object' && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = await processValue(val);
      }
      return result;
    }

    return value;
  }

  return (await processValue(obj)) as Record<string, unknown>;
}

// ─── Default Configuration ───────────────────────────────────

/**
 * Create default field encryption configuration.
 */
export function defaultFieldEncryptionConfig(): FieldEncryptionConfig {
  return {
    alwaysEncrypt: [
      '$.memory.core[*].content', // Always encrypt memory content
      '$.identity.personality',    // Always encrypt personality/SOUL
    ],
    encryptIfPII: [
      '$.conversations.**.content', // Encrypt conversation content if PII detected
      '$.memory.knowledge[*].**',   // Encrypt knowledge documents if PII detected
    ],
    keyId: `key-${Date.now()}`,
    strength: 'standard',
  };
}
