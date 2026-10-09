import { describe, expect, it } from 'vitest';
import { generateReceipt, verifyReceipt } from '../index.js';

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

    expect(verifyReceipt(receipt, encrypted)).toMatchObject({
      valid: true,
      actual_hash: receipt.encrypted_hash,
    });
  });
});
