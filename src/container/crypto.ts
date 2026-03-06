import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as argon2 from 'argon2';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16; // GCM standard

// Argon2id parameters (OWASP recommended)
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: KEY_LENGTH,
};

/**
 * Derives a key from a passphrase using Argon2id.
 * @param passphrase - The user's passphrase.
 * @param salt - A cryptographically secure salt.
 * @returns The derived key.
 */
async function deriveKeyFromPassphrase(passphrase: string, salt: Buffer): Promise<Buffer> {
  const hash = await argon2.hash(passphrase, {
    ...ARGON2_OPTIONS,
    salt,
    raw: true,
  });
  return hash;
}

/**
 * Reads a keyfile and derives a key from its contents.
 * @param keyfilePath - Path to the keyfile.
 * @param salt - A cryptographically secure salt.
 * @returns The derived key.
 */
async function deriveKeyFromKeyfile(keyfilePath: string, salt: Buffer): Promise<Buffer> {
  const keyfileContent = await readFile(keyfilePath);
  // Hash the keyfile content to derive a key
  const hash = await argon2.hash(keyfileContent, {
    ...ARGON2_OPTIONS,
    salt,
    raw: true,
  });
  return hash;
}

/**
 * Key source options - either passphrase or keyfile
 */
export interface KeySource {
  passphrase?: string;
  keyfile?: string;
}

/**
 * Validates key source and throws if invalid.
 */
function validateKeySource(keySource: KeySource): void {
  if (!keySource.passphrase && !keySource.keyfile) {
    throw new Error('Either passphrase or keyfile must be provided.');
  }
  if (keySource.passphrase && keySource.keyfile) {
    throw new Error('Cannot use both passphrase and keyfile. Choose one.');
  }
}

/**
 * Derives a key from either a passphrase or keyfile.
 */
async function deriveKey(keySource: KeySource, salt: Buffer): Promise<Buffer> {
  validateKeySource(keySource);
  
  if (keySource.keyfile) {
    return deriveKeyFromKeyfile(keySource.keyfile, salt);
  }
  return deriveKeyFromPassphrase(keySource.passphrase!, salt);
}

/**
 * Encrypts a plaintext buffer using AES-256-GCM.
 * @param plaintext - The data to encrypt.
 * @param keySource - Either passphrase or keyfile path for key derivation.
 * @returns A buffer containing the salt, IV, auth tag, and ciphertext.
 */
export async function encrypt(
  plaintext: Buffer,
  keySource: string | KeySource,
): Promise<Buffer> {
  // Support both string (passphrase) and KeySource object
  const normalizedKeySource: KeySource = typeof keySource === 'string' 
    ? { passphrase: keySource } 
    : keySource;
  
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(normalizedKeySource, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, ciphertext]);
}

/**
 * Decrypts a buffer encrypted with AES-256-GCM.
 * @param encrypted - The encrypted buffer (salt + iv + auth tag + ciphertext).
 * @param keySource - Either passphrase or keyfile path for key derivation.
 * @returns The decrypted plaintext buffer.
 * @throws If decryption fails (wrong passphrase, tampered data).
 */
export async function decrypt(
  encrypted: Buffer,
  keySource: string | KeySource,
): Promise<Buffer> {
  // Support both string (passphrase) and KeySource object
  const normalizedKeySource: KeySource = typeof keySource === 'string' 
    ? { passphrase: keySource } 
    : keySource;

  try {
    const salt = encrypted.subarray(0, SALT_LENGTH);
    const iv = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = encrypted.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const ciphertext = encrypted.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );

    const key = await deriveKey(normalizedKeySource, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted;
  } catch (error) {
    throw new Error(
      'Decryption failed. The passphrase may be incorrect or the data may be corrupted.',
    );
  }
}
