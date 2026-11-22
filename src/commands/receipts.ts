/**
 * savestate receipts — Inspect proofs created by successful saves.
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { countReceipts, listReceipts, type SaveReceipt } from '../save-receipt.js';

export interface ReceiptsOptions {
  json?: boolean;
  limit?: string;
  offset?: string;
}

export interface ReceiptsJson {
  found: boolean;
  total: number;
  shown: number;
  offset: number;
  limit: number;
  remaining: number;
  hasMore: boolean;
  nextOffset: number | null;
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

export function parseReceiptsOffset(value: string | undefined): number {
  if (value === undefined) return 0;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid --offset value "${value}". Expected a non-negative integer.`);
  }
  const offset = Number(normalized);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error(`Invalid --offset value "${value}". Expected a non-negative integer.`);
  }
  return offset;
}

export function formatReceipt(receipt: SaveReceipt): string {
  const status = receipt.verified ? chalk.green('verified') : chalk.yellow('unverified');
  return `${receipt.saved_at}  ${status}  ${receipt.resource_type}:${receipt.resource_id}  ${receipt.size} bytes  ${receipt.receipt_id}`;
}

export function formatReceiptsJson(
  receipts: SaveReceipt[],
  total: number,
  offset: number,
  limit: number,
): string {
  const shown = receipts.length;
  const nextOffset = offset + shown < total ? offset + shown : null;
  return JSON.stringify({
    found: shown > 0,
    total,
    shown,
    offset,
    limit,
    remaining: Math.max(0, total - offset - shown),
    hasMore: nextOffset !== null,
    nextOffset,
    receipts,
  } satisfies ReceiptsJson, null, 2);
}

export async function receiptsCommand(options: ReceiptsOptions): Promise<void> {
  if (!isInitialized()) {
    throw new Error('SaveState is not initialized. Run "savestate init" first.');
  }

  const offset = parseReceiptsOffset(options.offset);
  const limit = parseReceiptsLimit(options.limit);
  const receipts = await listReceipts(limit, undefined, offset);
  if (options.json) {
    const total = await countReceipts();
    console.log(formatReceiptsJson(receipts, total, offset, limit));
    return;
  }

  if (receipts.length === 0) {
    console.log('No save receipts found.');
    return;
  }

  console.log(chalk.bold(`Save receipts (${receipts.length})`));
  for (const receipt of receipts) console.log(formatReceipt(receipt));
}
