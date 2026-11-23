/**
 * savestate receipts — Inspect proofs created by successful saves.
 */

import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { loadReceipts, type SaveReceipt } from '../save-receipt.js';
import { parseListSince, parseListUntil, validateListDateRange } from './list.js';

export type ReceiptResourceType = SaveReceipt['resource_type'];

export interface ReceiptsOptions {
  json?: boolean;
  jsonSummary?: boolean;
  reverse?: boolean;
  oldestFirst?: boolean;
  verified?: boolean;
  unverified?: boolean;
  limit?: string;
  pageSize?: string;
  page?: string;
  offset?: string;
  type?: string;
  resource?: string;
  backend?: string;
  since?: string;
  until?: string;
}

export interface ReceiptsJson {
  found: boolean;
  type: ReceiptResourceType | null;
  resource: string | null;
  verified: boolean;
  unverified: boolean;
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
  nextPage: number | null;
  hasPrevious: boolean;
  previousOffset: number | null;
  previousPage: number | null;
  guidance: { action: 'none' | 'next' | 'previous' | 'retry'; offset: number | null };
  verification: { verified: number; unverified: number };
  verifiedPercentage: number;
  shownVerifiedPercentage: number;
  resourceCounts: { snapshot: number; memory: number; checkpoint: number };
  backendCounts: Record<string, number>;
  latestSavedAt: string | null;
  oldestSavedAt: string | null;
  shownBytes: number;
  averageShownBytes: number | null;
  totalBytes: number;
  averageTotalBytes: number | null;
  since: string | null;
  until: string | null;
  backend: string | null;
  oldestFirst: boolean;
  receipts?: SaveReceipt[];
}

export function validateReceiptOrdering(reverse = false, oldestFirst = false): void {
  if (reverse && oldestFirst) {
    throw new Error('Cannot use --oldest-first and --reverse together; choose one ordering flag.');
  }
}

export function countReceiptResources(receipts: SaveReceipt[]): ReceiptsJson['resourceCounts'] {
  return receipts.reduce((counts, receipt) => {
    counts[receipt.resource_type] += 1;
    return counts;
  }, { snapshot: 0, memory: 0, checkpoint: 0 });
}

export function countReceiptBackends(receipts: SaveReceipt[]): ReceiptsJson['backendCounts'] {
  return receipts.reduce<Record<string, number>>((counts, receipt) => {
    counts[receipt.storage_backend] = (counts[receipt.storage_backend] ?? 0) + 1;
    return counts;
  }, {});
}

export function formatReceiptsJson(
  receipts: SaveReceipt[],
  total: number,
  offset: number,
  limit: number,
  type: ReceiptResourceType | undefined = undefined,
  verificationOrVerified: { verified: number; unverified: number } | boolean = { verified: 0, unverified: 0 },
  unverified = false,
  verifiedFilter = false,
  unverifiedFilter = false,
  resourceOrCounts: string | ReceiptsJson['resourceCounts'] = countReceiptResources(receipts),
  completeResourceCounts?: ReceiptsJson['resourceCounts'],
  includeReceipts = true,
  totalBytes = receipts.reduce((sum, receipt) => sum + receipt.size, 0),
  since?: string,
  until?: string,
  oldestFirst = false,
  backend?: string,
  completeBackendCounts: ReceiptsJson['backendCounts'] = countReceiptBackends(receipts),
  completeSavedAtReceipts: SaveReceipt[] = receipts,
): string {
  const resource = typeof resourceOrCounts === 'string' ? resourceOrCounts : undefined;
  const resourceCounts = completeResourceCounts ?? (typeof resourceOrCounts === 'string' ? countReceiptResources(receipts) : resourceOrCounts);
  const verified = typeof verificationOrVerified === 'boolean' ? verificationOrVerified : verifiedFilter;
  const selectedUnverified = typeof verificationOrVerified === 'boolean' ? unverified : unverifiedFilter;
  const verification = typeof verificationOrVerified === 'boolean' ? { verified: 0, unverified: 0 } : verificationOrVerified;
  const shown = receipts.length;
  const verifiedPercentage = total === 0 ? 0 : (verification.verified / total) * 100;
  const shownVerifiedPercentage = shown === 0
    ? 0
    : (receipts.filter((receipt) => receipt.verified).length / shown) * 100;
  const suggestedOffset = shown === 0 && total > 0 ? Math.floor(Math.max(0, total - 1) / limit) * limit : null;
  const nextOffset = offset + shown < total ? offset + shown : null;
  const hasPrevious = offset > 0 && total > 0;
  const previousOffset = hasPrevious ? shown === 0 && suggestedOffset !== null ? suggestedOffset : Math.max(0, offset - limit) : null;
  const page = Math.floor(offset / limit) + 1;
  const nextPage = nextOffset === null ? null : Math.floor(nextOffset / limit) + 1;
  const previousPage = previousOffset === null ? null : Math.floor(previousOffset / limit) + 1;
  const savedAtValues = completeSavedAtReceipts.map((receipt) => Date.parse(receipt.saved_at)).filter(Number.isFinite);
  const latestSavedAt = savedAtValues.length === 0 ? null : new Date(Math.max(...savedAtValues)).toISOString();
  const oldestSavedAt = savedAtValues.length === 0 ? null : new Date(Math.min(...savedAtValues)).toISOString();
  const shownBytes = receipts.reduce((totalBytes, receipt) => totalBytes + receipt.size, 0);
  const averageShownBytes = shown === 0 ? null : shownBytes / shown;
  const averageTotalBytes = total === 0 ? null : totalBytes / total;
  const guidance = shown === 0 && suggestedOffset !== null
    ? { action: 'retry' as const, offset: suggestedOffset }
    : nextOffset !== null ? { action: 'next' as const, offset: nextOffset }
      : previousOffset !== null ? { action: 'previous' as const, offset: previousOffset }
        : { action: 'none' as const, offset: null };
  const output = { found: shown > 0, type: type ?? null, resource: resource ?? null, since: since ?? null, until: until ?? null, backend: backend ?? null, oldestFirst, verified, unverified: selectedUnverified, total, shown, emptyReason: shown > 0 ? null : total === 0 ? 'collection' : 'page', offset, limit,
    page, totalPages: total === 0 ? 0 : Math.ceil(total / limit), suggestedOffset,
    remaining: Math.max(0, total - offset - shown), hasMore: nextOffset !== null, isLastPage: nextOffset === null,
    nextOffset, nextPage, hasPrevious, previousOffset, previousPage, guidance, verification,
    verifiedPercentage, shownVerifiedPercentage, resourceCounts,
    latestSavedAt, oldestSavedAt, shownBytes, averageShownBytes, totalBytes, averageTotalBytes,
    backendCounts: completeBackendCounts,
    ...(includeReceipts ? { receipts } : {}) } satisfies ReceiptsJson;
  return JSON.stringify(output, null, 2);
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
  const normalized = value.trim().toLowerCase();
  if (normalized === 'snapshot' || normalized === 'memory' || normalized === 'checkpoint') return normalized;
  throw new Error(`Invalid --type value "${value}". Expected snapshot, memory, or checkpoint.`);
}

export function selectReceipts(
  receipts: SaveReceipt[],
  limit: number,
  offset: number,
  type?: ReceiptResourceType,
  verified = false,
  unverified = false,
  resource?: string,
  oldestFirst = false,
  backend?: string,
): SaveReceipt[] {
  const filtered = receipts.filter((receipt) =>
    (type === undefined || receipt.resource_type === type) &&
    (resource === undefined || receipt.resource_id === resource) &&
    (backend === undefined || receipt.storage_backend === backend) &&
    (verified === false || receipt.verified) &&
    (unverified === false || !receipt.verified),
  );
  if (oldestFirst) return filtered.slice(offset, offset + limit);
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
  return `saved:${receipt.saved_at}  created:${receipt.receipt_created_at}  ${status}  ${receipt.resource_type}:${receipt.resource_id}  ${receipt.size} bytes  ${receipt.receipt_id}  content:${receipt.content_hash}  encrypted:${receipt.encrypted_hash}  stored:${receipt.storage_backend}:${receipt.storage_location}`;
}

export function formatReceiptsText(
  receipts: SaveReceipt[],
  total: number,
  offset: number,
  limit: number,
  limitFlag = '--limit',
  navigation: 'offset' | 'page' = 'offset',
  type?: ReceiptResourceType,
  verified = false,
  unverified = false,
  resource?: string,
  since?: string,
  until?: string,
  oldestFirst = false,
  orderingFlag: '--oldest-first' | '--reverse' = '--oldest-first',
  backend?: string,
): string {
  const page = Math.floor(offset / limit) + 1;
  const pageArgument = (targetPage: number, targetOffset: number): string =>
    `${navigation === 'page' ? `--page ${targetPage}` : `--offset ${targetOffset}`}${type === undefined ? '' : ` --type ${type}`}${resource === undefined ? '' : ` --resource ${resource}`}${backend === undefined ? '' : ` --backend ${backend}`}${since === undefined ? '' : ` --since ${since}`}${until === undefined ? '' : ` --until ${until}`}${oldestFirst ? ` ${orderingFlag}` : ''}${verified ? ' --verified' : ''}${unverified ? ' --unverified' : ''}`;

  if (receipts.length === 0) {
    if (total === 0) return `${resource === undefined ? (type === undefined ? 'No save receipts found.' : `No ${type} save receipts found.`) : `No save receipts found for resource ${resource}.`}${verified ? ' (no verified receipts)' : ''}${unverified ? ' (no unverified receipts)' : ''}`;
    const lastOffset = Math.floor(Math.max(0, total - 1) / limit) * limit;
    const lastPage = Math.floor(lastOffset / limit) + 1;
    const location = navigation === 'page' ? `page ${page}` : `offset ${offset}`;
    return `No save receipts found at ${location}. Try "savestate receipts ${limitFlag} ${limit} ${pageArgument(lastPage, lastOffset)}".`;
  }

  const totalPages = Math.ceil(total / limit);
  const filterLabel = `${type === undefined ? '' : ` [type: ${type}]`}${resource === undefined ? '' : ` [resource: ${resource}]`}${backend === undefined ? '' : ` [backend: ${backend}]`}${since === undefined ? '' : ` [since: ${since}]`}${until === undefined ? '' : ` [until: ${until}]`}${verified ? ' [verified]' : ''}${unverified ? ' [unverified]' : ''}`;
  const lines = [`Save receipts (${receipts.length} of ${total}, page ${page}/${totalPages})${oldestFirst ? ' [oldest first]' : ''}${filterLabel}`];
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
  const resource = options.resource?.trim() || undefined;
  const backend = options.backend?.trim() || undefined;
  validateListDateRange(options.since, options.until);
  const since = parseListSince(options.since);
  const until = parseListUntil(options.until);
  validateReceiptOrdering(options.reverse === true, options.oldestFirst === true);
  if (options.verified === true && options.unverified === true) {
    throw new Error('Use either --verified or --unverified, not both.');
  }
  const { receipts: allReceipts } = await loadReceipts();
  const matchingReceipts = allReceipts.filter((receipt) =>
    (type === undefined || receipt.resource_type === type) &&
    (resource === undefined || receipt.resource_id === resource) &&
    (backend === undefined || receipt.storage_backend === backend) &&
    (since === undefined || Date.parse(receipt.saved_at) >= since) &&
    (until === undefined || Date.parse(receipt.saved_at) <= until) &&
    (options.verified !== true || receipt.verified) &&
    (options.unverified !== true || !receipt.verified),
  );
  const oldestFirst = options.oldestFirst === true || options.reverse === true;
  const receipts = selectReceipts(matchingReceipts, limit, offset, undefined, false, false, undefined, oldestFirst);
  if (options.json || options.jsonSummary) {
    const verification = matchingReceipts.reduce((counts, receipt) => {
      counts[receipt.verified ? 'verified' : 'unverified'] += 1;
      return counts;
    }, { verified: 0, unverified: 0 });
    const totalBytes = matchingReceipts.reduce((sum, receipt) => sum + receipt.size, 0);
    console.log(formatReceiptsJson(receipts, matchingReceipts.length, offset, limit, type, verification, false, options.verified === true, options.unverified === true, resource, countReceiptResources(matchingReceipts), !options.jsonSummary, totalBytes, options.since, options.until, oldestFirst, backend, countReceiptBackends(matchingReceipts), matchingReceipts));
    return;
  }

  const limitFlag = options.pageSize === undefined ? '--limit' : '--page-size';
  console.log(chalk.bold(formatReceiptsText(
    receipts,
    matchingReceipts.length,
    offset,
    limit,
    limitFlag,
    options.page === undefined ? 'offset' : 'page',
    type,
    options.verified === true,
    options.unverified === true,
    resource,
    options.since,
    options.until,
    oldestFirst,
    options.reverse === true ? '--reverse' : '--oldest-first',
    backend,
  )));
}
