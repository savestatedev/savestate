/**
 * Encryption Layer for Portable Container
 * Issue #104: AES-256-GCM with passphrase-derived key
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'crypto';
import { EncryptedPayload } from './format.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits for GCM
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive encryption key from passphrase using PBKDF2
 */
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt data with AES-256-GCM
 */
export function encrypt(data: string, passphrase: string): EncryptedPayload {
  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  
  // Derive key from passphrase
  const key = deriveKey(passphrase, salt);
  
  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(data, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext,
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt data with AES-256-GCM
 */
export function decrypt(payload: EncryptedPayload, passphrase: string): string {
  // Decode base64 values
  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  
  // Derive key from passphrase
  const key = deriveKey(passphrase, salt);
  
  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt
  let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Calculate checksum of encrypted payload
 */
export function calculateChecksum(payload: EncryptedPayload): string {
  const data = JSON.stringify(payload);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Verify checksum matches payload
 */
export function verifyChecksum(payload: EncryptedPayload, checksum: string): boolean {
  return calculateChecksum(payload) === checksum;
}

/**
 * Securely compare two strings in constant time
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
