/**
 * SaveState Save Receipt System
 *
 * Issue #126: Generates verifiable receipts for every successful save operation.
 * Receipts include content hash, timestamp, and storage location to enable
 * verification on restore.
 */

import { createHash, randomUUID } from 'node:crypto';
import { writeFile, readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { localConfigDir } from './config.js';

/**
 * A save receipt proves that data was successfully persisted.
 */
export interface SaveReceipt {
  /** Unique receipt ID */
  receipt_id: string;
  /** ID of the saved snapshot/memory */
  resource_id: string;
  /** Type of resource (snapshot, memory, checkpoint) */
  resource_type: 'snapshot' | 'memory' | 'checkpoint';
  /** SHA-256 hash of the content before encryption */
  content_hash: string;
  /** SHA-256 hash of the encrypted data */
  encrypted_hash: string;
  /** Size of encrypted data in bytes */
  size: number;
  /** Storage location (filename/key) */
  storage_location: string;
  /** Storage backend ID */
  storage_backend: string;
  /** ISO 8601 timestamp when save completed */
  saved_at: string;
  /** ISO 8601 timestamp when receipt was created */
  receipt_created_at: string;
  /** Write verification passed */
  verified: boolean;
}

/**
 * Receipt verification result
 */
export interface ReceiptVerification {
  /** Whether the verification passed */
  valid: boolean;
  /** Receipt that was verified */
  receipt: SaveReceipt;
  /** Actual hash of stored data (if readable) */
  actual_hash?: string;
  /** Actual size of stored data (if readable) */
  actual_size?: number;
  /** Error message if verification failed */
  error?: string;
  /** ISO 8601 timestamp of verification */
  verified_at: string;
}

/**
 * Receipt store for persisting and retrieving receipts
 */
export interface ReceiptStore {
  receipts: SaveReceipt[];
}

/**
 * Path to the receipts file
 */
function receiptsPath(cwd?: string): string {
  return join(localConfigDir(cwd), 'save-receipts.json');
}

/**
 * Load all receipts from storage
 */
export async function loadReceipts(cwd?: string): Promise<ReceiptStore> {
  const path = receiptsPath(cwd);
  if (!existsSync(path)) {
    return { receipts: [] };
  }
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ReceiptStore;
  } catch {
    return { receipts: [] };
  }
}

/**
 * Save receipts to storage atomically
 */
export async function saveReceipts(store: ReceiptStore, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const path = receiptsPath(cwd);

  // Atomic write with temp file
  const tempPath = `${path}.tmp.${Date.now()}`;
  const content = JSON.stringify(store, null, 2) + '\n';

  try {
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, path);
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Generate a save receipt for a successful write operation.
 */
export function generateReceipt(params: {
  resourceId: string;
  resourceType: 'snapshot' | 'memory' | 'checkpoint';
  contentData: Buffer;
  encryptedData: Buffer;
  storageLocation: string;
  storageBackend: string;
  savedAt: Date;
  verified: boolean;
}): SaveReceipt {
  const contentHash = createHash('sha256').update(params.contentData).digest('hex');
  const encryptedHash = createHash('sha256').update(params.encryptedData).digest('hex');

  return {
    receipt_id: randomUUID(),
    resource_id: params.resourceId,
    resource_type: params.resourceType,
    content_hash: contentHash,
    encrypted_hash: encryptedHash,
    size: params.encryptedData.length,
    storage_location: params.storageLocation,
    storage_backend: params.storageBackend,
    saved_at: params.savedAt.toISOString(),
    receipt_created_at: new Date().toISOString(),
    verified: params.verified,
  };
}

/**
 * Store a receipt for later verification
 */
export async function storeReceipt(receipt: SaveReceipt, cwd?: string): Promise<void> {
  const store = await loadReceipts(cwd);
  store.receipts.push(receipt);

  // Keep only last 1000 receipts to prevent unbounded growth
  if (store.receipts.length > 1000) {
    store.receipts = store.receipts.slice(-1000);
  }

  await saveReceipts(store, cwd);
}

/**
 * Find a receipt by resource ID
 */
export async function findReceipt(
  resourceId: string,
  cwd?: string
): Promise<SaveReceipt | null> {
  const store = await loadReceipts(cwd);
  // Return most recent receipt for this resource
  for (let i = store.receipts.length - 1; i >= 0; i--) {
    if (store.receipts[i].resource_id === resourceId) {
      return store.receipts[i];
    }
  }
  return null;
}

/**
 * Verify a receipt against actual stored data.
 *
 * @param receipt - The receipt to verify
 * @param storedData - The actual data read from storage
 * @returns Verification result
 */
export function verifyReceipt(
  receipt: SaveReceipt,
  storedData: Buffer
): ReceiptVerification {
  const actualHash = createHash('sha256').update(storedData).digest('hex');
  const actualSize = storedData.length;
  const verifiedAt = new Date().toISOString();

  if (actualSize !== receipt.size) {
    return {
      valid: false,
      receipt,
      actual_hash: actualHash,
      actual_size: actualSize,
      error: `Size mismatch: expected ${receipt.size}, got ${actualSize}`,
      verified_at: verifiedAt,
    };
  }

  if (actualHash !== receipt.encrypted_hash) {
    return {
      valid: false,
      receipt,
      actual_hash: actualHash,
      actual_size: actualSize,
      error: `Hash mismatch: expected ${receipt.encrypted_hash}, got ${actualHash}`,
      verified_at: verifiedAt,
    };
  }

  return {
    valid: true,
    receipt,
    actual_hash: actualHash,
    actual_size: actualSize,
    verified_at: verifiedAt,
  };
}

/**
 * Log a save operation for audit purposes.
 */
export interface SaveAuditEntry {
  timestamp: string;
  operation: 'save' | 'verify' | 'restore';
  resource_id: string;
  resource_type: 'snapshot' | 'memory' | 'checkpoint';
  success: boolean;
  receipt_id?: string;
  error?: string;
  duration_ms?: number;
}

const auditLog: SaveAuditEntry[] = [];

/**
 * Add an entry to the audit log
 */
export function logAudit(entry: SaveAuditEntry): void {
  auditLog.push(entry);
  // Keep only last 10000 entries in memory
  if (auditLog.length > 10000) {
    auditLog.shift();
  }
}

/**
 * Get recent audit entries
 */
export function getAuditLog(limit = 100): SaveAuditEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Clear the audit log (for testing)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}
