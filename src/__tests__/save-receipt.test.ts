import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAuditLog, loadReceipts, logAudit, clearAuditLog } from '../save-receipt.js';

const testDir = join(process.cwd(), '.tmp-save-receipt-test');

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  clearAuditLog();
});

describe('loadReceipts', () => {
  it('returns an empty store for a valid JSON file with the wrong shape', async () => {
    await mkdir(join(testDir, '.savestate'), { recursive: true });
    await writeFile(join(testDir, '.savestate', 'save-receipts.json'), JSON.stringify({ receipts: 'not-an-array' }));

    await expect(loadReceipts(testDir)).resolves.toEqual({ receipts: [] });
  });

  it('preserves valid receipts', async () => {
    const receipt = {
      receipt_id: 'receipt-1',
      resource_id: 'memory-1',
      resource_type: 'memory',
      content_hash: 'a'.repeat(64),
      encrypted_hash: 'b'.repeat(64),
      size: 42,
      storage_location: 'memory-1.saf.enc',
      storage_backend: 'local',
      saved_at: '2026-10-09T00:00:00.000Z',
      receipt_created_at: '2026-10-09T00:00:01.000Z',
      verified: true,
    };
    await mkdir(join(testDir, '.savestate'), { recursive: true });
    await writeFile(join(testDir, '.savestate', 'save-receipts.json'), JSON.stringify({ receipts: [receipt] }));

    await expect(loadReceipts(testDir)).resolves.toEqual({ receipts: [receipt] });
  });
});

describe('getAuditLog', () => {
  it('returns an empty page for non-positive or non-finite limits', () => {
    logAudit({
      timestamp: new Date().toISOString(),
      operation: 'save',
      resource_id: 'memory-1',
      resource_type: 'memory',
      success: true,
    });

    expect(getAuditLog(0)).toEqual([]);
    expect(getAuditLog(-1)).toEqual([]);
    expect(getAuditLog(Number.NaN)).toEqual([]);
    expect(getAuditLog(Number.POSITIVE_INFINITY)).toEqual([]);
  });
});
