/**
 * SaveState Encryption Module
 *
 * Provides AES-256-GCM encryption with scrypt key derivation.
 * All data is encrypted before leaving the machine.
 *
 * Key derivation: passphrase → scrypt → 256-bit key
 * Encryption: AES-256-GCM (authenticated encryption)
 * Integrity: Built into GCM auth tag
 */

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';

/** Encryption parameters */
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits (GCM standard)
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * scrypt parameters — intentionally memory-hard to resist brute force.
 * N=2^17 (~128MB), r=8, p=1 — comparable to Argon2id defaults.
 */
const SCRYPT_N = 131072; // 2^17 — CPU/memory cost
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelization

/**
 * Header format: [version(1)] [salt(32)] [iv(16)] [authTag(16)] [ciphertext(...)]
 * Total overhead: 1 + 32 + 16 + 16 = 65 bytes
 */
const HEADER_VERSION = 0x01;
const HEADER_OVERHEAD = 1 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;

/**
 * Derive an encryption key from a passphrase using scrypt.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024, // 256MB max memory
  });
}

/**
 * Encrypt data with a passphrase.
 *
 * Returns a single buffer containing the version header, salt, IV,
 * auth tag, and ciphertext. This buffer is self-contained — everything
 * needed to decrypt (except the passphrase) is included.
 *
 * @param data - Plaintext data to encrypt
 * @param passphrase - User passphrase for key derivation
 * @returns Encrypted buffer with header
 */
export async function encrypt(data: Buffer, passphrase: string): Promise<Buffer> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: [version][salt][iv][authTag][ciphertext]
  return Buffer.concat([
    Buffer.from([HEADER_VERSION]),
    salt,
    iv,
    authTag,
    encrypted,
  ]);
}

/**
 * Decrypt data with a passphrase.
 *
 * Reads the version header, extracts salt/IV/authTag, derives the key,
 * and decrypts. GCM auth tag verification ensures integrity automatically.
 *
 * @param data - Encrypted buffer (as produced by encrypt())
 * @param passphrase - User passphrase for key derivation
 * @returns Decrypted plaintext buffer
 * @throws Error if passphrase is wrong or data is tampered
 */
export async function decrypt(data: Buffer, passphrase: string): Promise<Buffer> {
  if (data.length < HEADER_OVERHEAD) {
    throw new Error('Invalid encrypted data: too short');
  }

  const version = data[0];
  if (version !== HEADER_VERSION) {
    throw new Error(`Unsupported encryption format version: ${version}`);
  }

  let offset = 1;
  const salt = data.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = data.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = data.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  const ciphertext = data.subarray(offset);

  const key = deriveKey(passphrase, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      'Decryption failed — wrong passphrase or corrupted data. ' +
      'GCM authentication tag verification failed.',
    );
  }
}

/**
 * Verify that encrypted data can be decrypted with the given passphrase
 * without actually returning the plaintext.
 */
export async function verify(data: Buffer, passphrase: string): Promise<boolean> {
  try {
    await decrypt(data, passphrase);
    return true;
  } catch {
    return false;
  }
}
