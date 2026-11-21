/**
 * savestate receipts — Inspect proofs created by successful saves.
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { listReceipts, type SaveReceipt } from '../save-receipt.js';

export interface ReceiptsOptions {
  json?: boolean;
  limit?: string;
}

export interface ReceiptsJson {
  found: boolean;
  shown: number;
  receipts: SaveReceipt[];
}

export function parseReceiptsLimit(value: string | undefined): number {
  if (value === undefined) return 100;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid --limit value "${value}". Expected a positive integer up to 1000.`);
  }
  const limit = Number(normalized);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error(`Invalid --limit value "${value}". Expected a positive integer up to 1000.`);
  }
  return limit;
}

export function formatReceipt(receipt: SaveReceipt): string {
  const status = receipt.verified ? chalk.green('verified') : chalk.yellow('unverified');
  return `${receipt.saved_at}  ${status}  ${receipt.resource_type}:${receipt.resource_id}  ${receipt.size} bytes  ${receipt.receipt_id}`;
}

export async function receiptsCommand(options: ReceiptsOptions): Promise<void> {
  if (!isInitialized()) {
    throw new Error('SaveState is not initialized. Run "savestate init" first.');
  }

  const receipts = await listReceipts(parseReceiptsLimit(options.limit));
  if (options.json) {
    const output: ReceiptsJson = { found: receipts.length > 0, shown: receipts.length, receipts };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (receipts.length === 0) {
    console.log('No save receipts found.');
    return;
  }

  console.log(chalk.bold(`Save receipts (${receipts.length})`));
  for (const receipt of receipts) console.log(formatReceipt(receipt));
}
