import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadReceipts } from '../save-receipt.js';

const testDir = join(process.cwd(), '.tmp-save-receipt-test');

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('loadReceipts', () => {
  it('returns an empty store for a valid JSON file with the wrong shape', async () => {
    await mkdir(join(testDir, '.savestate'), { recursive: true });
    await writeFile(join(testDir, '.savestate', 'save-receipts.json'), JSON.stringify({ receipts: 'not-an-array' }));

    await expect(loadReceipts(testDir)).resolves.toEqual({ receipts: [] });
  });

  it('preserves valid receipts', async () => {
    const receipt = { resource_id: 'memory-1', resource_type: 'memory' };
    await mkdir(join(testDir, '.savestate'), { recursive: true });
    await writeFile(join(testDir, '.savestate', 'save-receipts.json'), JSON.stringify({ receipts: [receipt] }));

    await expect(loadReceipts(testDir)).resolves.toEqual({ receipts: [receipt] });
  });
});
