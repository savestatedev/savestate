/**
 * savestate receipts — Inspect proofs created by successful saves.
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { loadReceipts, type SaveReceipt } from '../save-receipt.js';

export type ReceiptResourceType = SaveReceipt['resource_type'];

export interface ReceiptsOptions {
  json?: boolean;
  limit?: string;
  pageSize?: string;
  page?: string;
  offset?: string;
  type?: string;
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

export function resolveReceiptsLimit(limit: string | undefined, pageSize: string | undefined): number {
  if (limit !== undefined && pageSize !== undefined) {
    throw new Error('Use either --limit or --page-size, not both.');
  }
  return parseReceiptsLimit(pageSize ?? limit);
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

export function parseReceiptType(value: string | undefined): ReceiptResourceType | undefined {
  if (value === undefined) return undefined;
  if (value === 'snapshot' || value === 'memory' || value === 'checkpoint') return value;
  throw new Error(`Invalid --type value "${value}". Expected snapshot, memory, or checkpoint.`);
}

export function selectReceipts(
  receipts: SaveReceipt[],
  limit: number,
  offset: number,
  type?: ReceiptResourceType,
): SaveReceipt[] {
  const filtered = type === undefined ? receipts : receipts.filter((receipt) => receipt.resource_type === type);
  const end = filtered.length - offset;
  if (end <= 0) return [];
  return filtered.slice(Math.max(0, end - limit), end).reverse();
}

export function resolveReceiptsOffset(offset: string | undefined, page: string | undefined, limit: number): number {
  if (offset !== undefined && page !== undefined) {
    throw new Error('Use either --offset or --page, not both.');
  }
  if (page === undefined) return parseReceiptsOffset(offset);
  const pageNumber = parseReceiptsOffset(page);
  if (pageNumber < 1) {
    throw new Error(`Invalid --page value "${page}". Expected a positive integer.`);
  }
  const resolvedOffset = (pageNumber - 1) * limit;
  if (!Number.isSafeInteger(resolvedOffset)) {
    throw new Error(`Invalid --page value "${page}". Page is too large.`);
  }
  return resolvedOffset;
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
  limitFlag = '--limit',
  navigation: 'offset' | 'page' = 'offset',
): string {
  const page = Math.floor(offset / limit) + 1;
  const pageArgument = (targetPage: number, targetOffset: number): string =>
    navigation === 'page' ? `--page ${targetPage}` : `--offset ${targetOffset}`;

  if (receipts.length === 0) {
    if (total === 0) return 'No save receipts found.';
    const lastOffset = Math.floor(Math.max(0, total - 1) / limit) * limit;
    const lastPage = Math.floor(lastOffset / limit) + 1;
    const location = navigation === 'page' ? `page ${page}` : `offset ${offset}`;
    return `No save receipts found at ${location}. Try "savestate receipts ${limitFlag} ${limit} ${pageArgument(lastPage, lastOffset)}".`;
  }

  const totalPages = Math.ceil(total / limit);
  const lines = [`Save receipts (${receipts.length} of ${total}, page ${page}/${totalPages})`];
  lines.push(...receipts.map(formatReceipt));

  if (offset + receipts.length < total) {
    const nextOffset = offset + receipts.length;
    lines.push(`Next page: savestate receipts ${limitFlag} ${limit} ${pageArgument(page + 1, nextOffset)}`);
  }
  if (offset > 0) {
    const previousOffset = Math.max(0, offset - limit);
    lines.push(`Previous page: savestate receipts ${limitFlag} ${limit} ${pageArgument(page - 1, previousOffset)}`);
  }
  return lines.join('\n');
}

export async function receiptsCommand(options: ReceiptsOptions): Promise<void> {
  if (!isInitialized()) {
    throw new Error('SaveState is not initialized. Run "savestate init" first.');
  }

  const limit = resolveReceiptsLimit(options.limit, options.pageSize);
  const offset = resolveReceiptsOffset(options.offset, options.page, limit);
  const type = parseReceiptType(options.type);
  const { receipts: allReceipts } = await loadReceipts();
  const matchingReceipts = type === undefined
    ? allReceipts
    : allReceipts.filter((receipt) => receipt.resource_type === type);
  const receipts = selectReceipts(matchingReceipts, limit, offset);
  if (options.json) {
    console.log(formatReceiptsJson(receipts, matchingReceipts.length, offset, limit));
    return;
  }

  const limitFlag = options.pageSize === undefined ? '--limit' : '--page-size';
  console.log(chalk.bold(formatReceiptsText(
    receipts,
    allReceipts.length,
    offset,
    limit,
    limitFlag,
    options.page === undefined ? 'offset' : 'page',
  )));
}
