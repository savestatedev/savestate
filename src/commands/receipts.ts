/**
 * savestate receipts — Inspect proofs created by successful saves.
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { countReceipts, listReceipts, loadReceipts, type SaveReceipt } from '../save-receipt.js';

export interface ReceiptsOptions {
  json?: boolean;
  limit?: string;
  offset?: string;
}

export interface ReceiptsJson {
  found: boolean;
  total: number;
  shown: number;
  emptyReason: 'collection' | 'page' | null;
  offset: number;
  limit: number;
  page: number;
  totalPages: number;
  suggestedOffset: number | null;
  remaining: number;
  hasMore: boolean;
  isLastPage: boolean;
  nextOffset: number | null;
  hasPrevious: boolean;
  previousOffset: number | null;
  guidance: { action: 'none' | 'next' | 'previous' | 'retry'; offset: number | null };
  receipts: SaveReceipt[];
}

export function formatReceiptsJson(receipts: SaveReceipt[], total: number, offset: number, limit: number): string {
  const shown = receipts.length;
  const suggestedOffset = shown === 0 && total > 0 ? Math.floor(Math.max(0, total - 1) / limit) * limit : null;
  const nextOffset = offset + shown < total ? offset + shown : null;
  const hasPrevious = offset > 0 && total > 0;
  const previousOffset = hasPrevious ? shown === 0 && suggestedOffset !== null ? suggestedOffset : Math.max(0, offset - limit) : null;
  const guidance = shown === 0 && suggestedOffset !== null
    ? { action: 'retry' as const, offset: suggestedOffset }
    : nextOffset !== null ? { action: 'next' as const, offset: nextOffset }
      : previousOffset !== null ? { action: 'previous' as const, offset: previousOffset }
        : { action: 'none' as const, offset: null };
  return JSON.stringify({ found: shown > 0, total, shown, emptyReason: shown > 0 ? null : total === 0 ? 'collection' : 'page', offset, limit,
    page: Math.floor(offset / limit) + 1, totalPages: total === 0 ? 0 : Math.ceil(total / limit), suggestedOffset,
    remaining: Math.max(0, total - offset - shown), hasMore: nextOffset !== null, isLastPage: nextOffset === null,
    nextOffset, hasPrevious, previousOffset, guidance, receipts } satisfies ReceiptsJson, null, 2);
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

export function formatReceiptsText(
  receipts: SaveReceipt[],
  total: number,
  offset: number,
  limit: number,
): string {
  if (receipts.length === 0) {
    if (total === 0) return 'No save receipts found.';
    const lastOffset = Math.floor(Math.max(0, total - 1) / limit) * limit;
    return `No save receipts found at offset ${offset}. Try "savestate receipts --limit ${limit} --offset ${lastOffset}".`;
  }

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const lines = [`Save receipts (${receipts.length} of ${total}, page ${page}/${totalPages})`];
  lines.push(...receipts.map(formatReceipt));

  if (offset + receipts.length < total) {
    lines.push(`Next page: savestate receipts --limit ${limit} --offset ${offset + receipts.length}`);
  }
  if (offset > 0) {
    lines.push(`Previous page: savestate receipts --limit ${limit} --offset ${Math.max(0, offset - limit)}`);
  }
  return lines.join('\n');
}

export async function receiptsCommand(options: ReceiptsOptions): Promise<void> {
  if (!isInitialized()) {
    throw new Error('SaveState is not initialized. Run "savestate init" first.');
  }

  const offset = parseReceiptsOffset(options.offset);
  const limit = parseReceiptsLimit(options.limit);
  const receipts = await listReceipts(limit, undefined, offset);
  if (options.json) {
    console.log(formatReceiptsJson(receipts, await countReceipts(), offset, limit));
    return;
  }

  const { receipts: allReceipts } = await loadReceipts();
  console.log(chalk.bold(formatReceiptsText(receipts, allReceipts.length, offset, limit)));
}
