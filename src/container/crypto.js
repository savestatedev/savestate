import { createCipheriv, createDecipheriv, scrypt as scryptAsync, randomBytes, } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptAsync);
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16; // GCM standard
/**
 * Derives a key from a passphrase using Argon2id.
 * @param passphrase - The user's passphrase.
 * @param salt - A cryptographically secure salt.
 * @returns The derived key.
 */
async function deriveKey(passphrase, salt) {
    return (await scrypt(passphrase, salt, KEY_LENGTH));
}
/**
 * Encrypts a plaintext buffer using AES-256-GCM.
 * @param plaintext - The data to encrypt.
 * @param passphrase - The passphrase for key derivation.
 * @returns A buffer containing the salt, IV, auth tag, and ciphertext.
 */
export async function encrypt(plaintext, passphrase) {
    const salt = randomBytes(SALT_LENGTH);
    const key = await deriveKey(passphrase, salt);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, authTag, ciphertext]);
}
/**
 * Decrypts a buffer encrypted with AES-256-GCM.
 * @param encrypted - The encrypted buffer (salt + iv + auth tag + ciphertext).
 * @param passphrase - The passphrase for key derivation.
 * @returns The decrypted plaintext buffer.
 * @throws If decryption fails (wrong passphrase, tampered data).
 */
export async function decrypt(encrypted, passphrase) {
    try {
        const salt = encrypted.subarray(0, SALT_LENGTH);
        const iv = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = encrypted.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = encrypted.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const key = await deriveKey(passphrase, salt);
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return decrypted;
    }
    catch (error) {
        throw new Error('Decryption failed. The passphrase may be incorrect or the data may be corrupted.');
    }
}
