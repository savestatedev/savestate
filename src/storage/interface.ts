/**
 * Storage Backend Interface
 *
 * All storage backends receive only encrypted data.
 * Zero-knowledge by design — the backend never sees plaintext.
 */

export type { StorageBackend } from '../types.js';
