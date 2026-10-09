import { describe, expect, it } from 'vitest';
import {
  generateReceipt,
  listReceipts,
  storeReceipt,
  verifyReceipt,
  type ReceiptVerification,
  type SaveReceipt,
} from '../index.js';

describe('public save receipt API', () => {
  it('exports receipt generation and verification for SDK consumers', () => {
    const content = Buffer.from('memory');
    const encrypted = Buffer.from('encrypted-memory');
    const receipt = generateReceipt({
      resourceId: 'memory-1',
      resourceType: 'memory',
      contentData: content,
      encryptedData: encrypted,
      storageLocation: 'local://memory-1',
      storageBackend: 'local',
      savedAt: new Date('2026-01-01T00:00:00.000Z'),
      verified: true,
    });

    const typedReceipt: SaveReceipt = receipt;
    const verification: ReceiptVerification = verifyReceipt(typedReceipt, encrypted);

    expect(verification).toMatchObject({
      valid: true,
      actual_hash: receipt.encrypted_hash,
    });
  });

  it('lists newest receipts first with a bounded limit', async () => {
    const cwd = '.tmp-public-api-receipts';
    const first = generateReceipt({
      resourceId: 'memory-1', resourceType: 'memory', contentData: Buffer.from('a'),
      encryptedData: Buffer.from('ea'), storageLocation: 'local://1', storageBackend: 'local',
      savedAt: new Date('2026-01-01T00:00:00.000Z'), verified: true,
    });
    const second = generateReceipt({
      resourceId: 'memory-2', resourceType: 'memory', contentData: Buffer.from('b'),
      encryptedData: Buffer.from('eb'), storageLocation: 'local://2', storageBackend: 'local',
      savedAt: new Date('2026-01-02T00:00:00.000Z'), verified: true,
    });

    await storeReceipt(first, cwd);
    await storeReceipt(second, cwd);

    await expect(listReceipts(1, cwd)).resolves.toEqual([second]);
    await expect(listReceipts(0, cwd)).resolves.toEqual([]);
  });
});
