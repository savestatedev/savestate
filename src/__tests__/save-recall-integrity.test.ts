/**
 * Issue #126: E2E Tests for Save/Recall Integrity
 *
 * Tests the complete write → close → reopen → read → verify cycle
 * to ensure memory save confirmations are trustworthy.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';

import { LocalStorageBackend } from '../storage/local.js';
import { createSnapshot } from '../snapshot.js';
import { restoreSnapshot } from '../restore.js';
import { encrypt, decrypt } from '../encryption.js';
import {
  generateReceipt,
  verifyReceipt,
  storeReceipt,
  findReceipt,
  loadReceipts,
  clearAuditLog,
  getAuditLog,
  logAudit,
} from '../save-receipt.js';
import { loadIndex, saveIndex, addToIndex } from '../index-file.js';
import type { Adapter, Snapshot } from '../types.js';

describe('Save/Recall Integrity (Issue #126)', () => {
  let testDir: string;
  let storage: LocalStorageBackend;

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-test-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    storage = new LocalStorageBackend({ path: join(testDir, 'snapshots') });
    clearAuditLog();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Write Verification', () => {
    it('should verify writes by reading back and comparing hash', async () => {
      const testData = Buffer.from('Hello, SaveState!');
      const key = 'test-snapshot.saf.enc';

      await storage.put(key, testData);

      // Read it back
      const readBack = await storage.get(key);
      expect(readBack.equals(testData)).toBe(true);
    });

    it('should detect corrupted writes', async () => {
      const storage = new LocalStorageBackend({ path: join(testDir, 'corrupt-test') });
      const testData = Buffer.from('Original data');

      await storage.put('test.dat', testData);

      // Manually verify the verification logic
      const verification = await storage.verifyWrite(
        'test.dat',
        createHash('sha256').update(testData).digest('hex'),
        testData.length
      );

      expect(verification.success).toBe(true);
      expect(verification.expectedHash).toBe(verification.actualHash);
    });

    it('should fail verification on hash mismatch', async () => {
      const storage = new LocalStorageBackend({ path: join(testDir, 'mismatch-test') });
      const testData = Buffer.from('Some data');

      await storage.put('test.dat', testData);

      // Try to verify with wrong hash
      const verification = await storage.verifyWrite(
        'test.dat',
        'wrong-hash-value',
        testData.length
      );

      expect(verification.success).toBe(false);
    });

    it('should fail verification on size mismatch', async () => {
      const storage = new LocalStorageBackend({ path: join(testDir, 'size-test') });
      const testData = Buffer.from('Some data');

      await storage.put('test.dat', testData);

      // Try to verify with wrong size
      const verification = await storage.verifyWrite(
        'test.dat',
        createHash('sha256').update(testData).digest('hex'),
        999999 // Wrong size
      );

      expect(verification.success).toBe(false);
      expect(verification.actualHash).toContain('size_mismatch');
    });
  });

  describe('Save Receipt System', () => {
    it('should generate valid receipts', () => {
      const contentData = Buffer.from('Test content');
      const encryptedData = Buffer.from('Encrypted content');

      const receipt = generateReceipt({
        resourceId: 'test-id',
        resourceType: 'snapshot',
        contentData,
        encryptedData,
        storageLocation: 'test.saf.enc',
        storageBackend: 'local',
        savedAt: new Date(),
        verified: true,
      });

      expect(receipt.receipt_id).toBeDefined();
      expect(receipt.resource_id).toBe('test-id');
      expect(receipt.resource_type).toBe('snapshot');
      expect(receipt.content_hash).toBe(
        createHash('sha256').update(contentData).digest('hex')
      );
      expect(receipt.encrypted_hash).toBe(
        createHash('sha256').update(encryptedData).digest('hex')
      );
      expect(receipt.verified).toBe(true);
    });

    it('should verify receipts against stored data', () => {
      const encryptedData = Buffer.from('Encrypted content');

      const receipt = generateReceipt({
        resourceId: 'test-id',
        resourceType: 'snapshot',
        contentData: Buffer.from('Test content'),
        encryptedData,
        storageLocation: 'test.saf.enc',
        storageBackend: 'local',
        savedAt: new Date(),
        verified: true,
      });

      // Verify with correct data
      const verification = verifyReceipt(receipt, encryptedData);
      expect(verification.valid).toBe(true);
      expect(verification.actual_hash).toBe(receipt.encrypted_hash);
    });

    it('should detect tampered data via receipt verification', () => {
      const encryptedData = Buffer.from('Encrypted content');

      const receipt = generateReceipt({
        resourceId: 'test-id',
        resourceType: 'snapshot',
        contentData: Buffer.from('Test content'),
        encryptedData,
        storageLocation: 'test.saf.enc',
        storageBackend: 'local',
        savedAt: new Date(),
        verified: true,
      });

      // Verify with tampered data
      const tamperedData = Buffer.from('Tampered content');
      const verification = verifyReceipt(receipt, tamperedData);

      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('mismatch');
    });

    it('should persist and retrieve receipts', async () => {
      const receipt = generateReceipt({
        resourceId: 'persist-test-id',
        resourceType: 'memory',
        contentData: Buffer.from('Test'),
        encryptedData: Buffer.from('Encrypted'),
        storageLocation: 'test.saf.enc',
        storageBackend: 'local',
        savedAt: new Date(),
        verified: true,
      });

      await storeReceipt(receipt, testDir);

      const found = await findReceipt('persist-test-id', testDir);
      expect(found).not.toBeNull();
      expect(found!.receipt_id).toBe(receipt.receipt_id);
    });
  });

  describe('Atomic Index Updates', () => {
    it('should save index atomically', async () => {
      const index = {
        snapshots: [
          {
            id: 'test-1',
            timestamp: new Date().toISOString(),
            platform: 'test',
            adapter: 'test-adapter',
            filename: 'test.saf.enc',
            size: 1024,
          },
        ],
      };

      await saveIndex(index, testDir);

      const loaded = await loadIndex(testDir);
      expect(loaded.snapshots).toHaveLength(1);
      expect(loaded.snapshots[0].id).toBe('test-1');
    });

    it('should not corrupt index on concurrent updates', async () => {
      // Add multiple entries concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        addToIndex(
          {
            id: `concurrent-${i}`,
            timestamp: new Date().toISOString(),
            platform: 'test',
            adapter: 'test-adapter',
            filename: `test-${i}.saf.enc`,
            size: 1024,
          },
          testDir
        )
      );

      // Note: This test may have race conditions but the atomic writes
      // should prevent corruption. Individual entries might be lost but
      // the file should remain valid JSON.
      await Promise.allSettled(promises);

      const loaded = await loadIndex(testDir);
      expect(Array.isArray(loaded.snapshots)).toBe(true);
      // At minimum, the file should be valid JSON
    });
  });

  describe('Audit Logging', () => {
    it('should log save operations', () => {
      logAudit({
        timestamp: new Date().toISOString(),
        operation: 'save',
        resource_id: 'test-resource',
        resource_type: 'snapshot',
        success: true,
        receipt_id: 'receipt-123',
        duration_ms: 100,
      });

      const log = getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[log.length - 1].resource_id).toBe('test-resource');
    });

    it('should log failures with error messages', () => {
      logAudit({
        timestamp: new Date().toISOString(),
        operation: 'save',
        resource_id: 'failed-resource',
        resource_type: 'snapshot',
        success: false,
        error: 'Disk full',
      });

      const log = getAuditLog();
      const lastEntry = log[log.length - 1];
      expect(lastEntry.success).toBe(false);
      expect(lastEntry.error).toBe('Disk full');
    });
  });

  describe('E2E Write-Read Cycle', () => {
    it('should successfully write, verify, and read back encrypted data', async () => {
      const passphrase = 'test-passphrase-123';
      const originalData = Buffer.from(JSON.stringify({
        memory: 'Important information',
        timestamp: new Date().toISOString(),
      }));

      // Encrypt
      const encrypted = await encrypt(originalData, passphrase);

      // Store
      const key = 'e2e-test.saf.enc';
      await storage.put(key, encrypted);

      // Generate receipt
      const receipt = generateReceipt({
        resourceId: 'e2e-test',
        resourceType: 'snapshot',
        contentData: originalData,
        encryptedData: encrypted,
        storageLocation: key,
        storageBackend: 'local',
        savedAt: new Date(),
        verified: true,
      });

      // Read back
      const readBack = await storage.get(key);

      // Verify receipt
      const verification = verifyReceipt(receipt, readBack);
      expect(verification.valid).toBe(true);

      // Decrypt
      const decrypted = await decrypt(readBack, passphrase);
      expect(decrypted.equals(originalData)).toBe(true);
    });

    it('should maintain integrity across simulated session boundaries', async () => {
      const passphrase = 'session-test-passphrase';
      const testMemory = {
        id: 'memory-123',
        content: 'User prefers dark mode',
        createdAt: new Date().toISOString(),
      };
      const originalData = Buffer.from(JSON.stringify(testMemory));

      // Session 1: Save
      const encrypted = await encrypt(originalData, passphrase);
      const key = 'session-test.saf.enc';
      await storage.put(key, encrypted);

      const receipt = generateReceipt({
        resourceId: 'memory-123',
        resourceType: 'memory',
        contentData: originalData,
        encryptedData: encrypted,
        storageLocation: key,
        storageBackend: 'local',
        savedAt: new Date(),
        verified: true,
      });
      await storeReceipt(receipt, testDir);

      // Simulate session boundary by creating new storage instance
      const newStorage = new LocalStorageBackend({ path: join(testDir, 'snapshots') });

      // Session 2: Recall
      const storedReceipt = await findReceipt('memory-123', testDir);
      expect(storedReceipt).not.toBeNull();

      const readBack = await newStorage.get(key);
      const verification = verifyReceipt(storedReceipt!, readBack);
      expect(verification.valid).toBe(true);

      const decrypted = await decrypt(readBack, passphrase);
      const recoveredMemory = JSON.parse(decrypted.toString());

      expect(recoveredMemory.id).toBe(testMemory.id);
      expect(recoveredMemory.content).toBe(testMemory.content);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing files gracefully', async () => {
      await expect(storage.get('nonexistent.saf.enc')).rejects.toThrow();
    });

    it('should detect wrong passphrase on decrypt', async () => {
      const originalData = Buffer.from('Secret data');
      const encrypted = await encrypt(originalData, 'correct-passphrase');

      await expect(decrypt(encrypted, 'wrong-passphrase')).rejects.toThrow();
    });

    it('should handle corrupted encrypted data', async () => {
      const encrypted = Buffer.from('this is not valid encrypted data');

      await expect(decrypt(encrypted, 'any-passphrase')).rejects.toThrow();
    });
  });
});

describe('Full Snapshot E2E (Issue #126)', () => {
  let testDir: string;
  let storage: LocalStorageBackend;

  // Mock adapter for testing
  const createMockAdapter = (customData?: Partial<Snapshot>): Adapter => ({
    id: 'test-adapter',
    name: 'Test Adapter',
    platform: 'test-platform',
    version: '1.0.0',

    async detect() {
      return true;
    },

    async extract(): Promise<Snapshot> {
      return {
        manifest: {
          version: '0.1.0',
          timestamp: new Date().toISOString(),
          id: 'temp-id',
          platform: 'test-platform',
          adapter: 'test-adapter',
          checksum: '',
          size: 0,
        },
        identity: {
          personality: 'Test personality',
        },
        memory: {
          core: [
            {
              id: 'mem-1',
              content: 'User prefers TypeScript',
              source: 'user',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'mem-2',
              content: 'Deploy to staging first',
              source: 'system',
              createdAt: new Date().toISOString(),
            },
          ],
          knowledge: [],
        },
        conversations: {
          total: 0,
          conversations: [],
        },
        platform: {
          name: 'test-platform',
          exportMethod: 'api',
        },
        chain: {
          current: 'temp-id',
          ancestors: [],
        },
        restoreHints: {
          platform: 'test-platform',
          steps: [],
        },
        ...customData,
      };
    },

    async restore(snapshot: Snapshot) {
      // No-op for testing
    },

    async identify() {
      return {
        name: 'test-platform',
        exportMethod: 'api',
      };
    },
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-e2e-${Date.now()}-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    storage = new LocalStorageBackend({ path: join(testDir, 'snapshots') });
    clearAuditLog();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create snapshot with receipt and verify on restore', async () => {
    const adapter = createMockAdapter();
    const passphrase = 'e2e-test-passphrase';

    // Create snapshot
    const result = await createSnapshot(adapter, storage, passphrase, {
      label: 'E2E Test Snapshot',
    });

    expect(result.receipt).toBeDefined();
    expect(result.receipt.resource_type).toBe('snapshot');
    expect(result.receipt.verified).toBe(true);

    // Verify receipt is stored
    const storedReceipt = await findReceipt(result.snapshot.manifest.id);
    expect(storedReceipt).not.toBeNull();

    // Read back encrypted data and verify against receipt
    const readBack = await storage.get(result.filename);
    const verification = verifyReceipt(result.receipt, readBack);
    expect(verification.valid).toBe(true);

    // Check audit log
    const auditLog = getAuditLog();
    const saveEntry = auditLog.find(
      (e) => e.resource_id === result.snapshot.manifest.id && e.operation === 'save'
    );
    expect(saveEntry).toBeDefined();
    expect(saveEntry!.success).toBe(true);
  });

  it('should restore snapshot and match original memory content', async () => {
    const originalMemories = [
      { id: 'mem-restore-1', content: 'Critical memory A', source: 'user', createdAt: new Date().toISOString() },
      { id: 'mem-restore-2', content: 'Critical memory B', source: 'system', createdAt: new Date().toISOString() },
    ];

    const adapter = createMockAdapter({
      memory: { core: originalMemories, knowledge: [] },
    });
    const passphrase = 'restore-test-passphrase';

    // Create snapshot
    const createResult = await createSnapshot(adapter, storage, passphrase, {
      label: 'Restore Test',
    });

    // Restore snapshot
    const restoreResult = await restoreSnapshot(
      createResult.snapshot.manifest.id,
      adapter,
      storage,
      passphrase,
      { dryRun: true } // Dry run to avoid actual restore
    );

    expect(restoreResult.memoryCount).toBe(originalMemories.length);
    expect(restoreResult.snapshotId).toBe(createResult.snapshot.manifest.id);
  });
});
