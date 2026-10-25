import {
  hasValidMemoryImportanceRange,
  INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
} from './memory-importance-range.js';
import type { MemoryType } from '../memory/types.js';

const MEMORY_TYPES: readonly MemoryType[] = ['fact', 'event', 'preference', 'conversation'];

/** Parse an optional memory resource tag without turning a blank filter into an unfiltered query. */
export function parseMemoriesResourceTag(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid tag value. Expected a non-empty tag.');
  }

  return normalized;
}

/** Parse an optional memory resource search without turning a blank query into an unfiltered request. */
export function parseMemoriesResourceSearch(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid search value. Expected a non-empty search query.');
  }

  return normalized;
}

/** Parse an optional memory resource creation bound and normalize it for SQLite. */
export function parseMemoriesResourceDate(
  value: string | null,
  name: 'since' | 'until',
): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized);
  if (normalized.length === 0 || (!dateOnly && !timestamp)) {
    throw new Error(
      `Invalid ${name} value "${value}". Expected an ISO-8601 date or timestamp.`,
    );
  }
  const candidate = dateOnly
    ? `${normalized}T${name === 'until' ? '23:59:59.999' : '00:00:00.000'}Z`
    : normalized;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Invalid ${name} value "${value}". Expected an ISO-8601 date or timestamp.`,
    );
  }

  // Date.parse accepts rollover dates such as 2026-02-30; reject those for
  // date-only filters so a typo never broadens the requested time range.
  if (dateOnly && new Date(parsed).toISOString().slice(0, 10) !== normalized) {
    throw new Error(
      `Invalid ${name} value "${value}". Expected an ISO-8601 date or timestamp.`,
    );
  }

  return new Date(parsed).toISOString();
}

/** Reject an impossible creation-date range before querying the memory store. */
export function validateMemoriesResourceDateRange(
  since: string | undefined,
  until: string | undefined,
): void {
  if (since !== undefined && until !== undefined && since > until) {
    throw new Error('since must be at or before until');
  }
}

/** Parse an optional memory resource type without silently widening the query. */
export function parseMemoriesResourceType(value: string | null): MemoryType | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (!MEMORY_TYPES.includes(normalized as MemoryType)) {
    throw new Error(
      `Invalid type value "${value}". Expected one of: ${MEMORY_TYPES.join(', ')}.`,
    );
  }

  return normalized as MemoryType;
}

const MAX_MEMORY_IMPORTANCE = 1;
const MIN_MEMORY_IMPORTANCE = 0;

/** Parse a memory resource importance query without silently widening its scope. */
export function parseMemoriesResourceImportance(
  value: string | null,
  name: 'minImportance' | 'maxImportance',
): number | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  const parsed = Number(normalized);
  if (
    normalized.length === 0 ||
    !Number.isFinite(parsed) ||
    parsed < MIN_MEMORY_IMPORTANCE ||
    parsed > MAX_MEMORY_IMPORTANCE
  ) {
    throw new Error(
      `Invalid ${name} value "${value}". Expected a number between ${MIN_MEMORY_IMPORTANCE} and ${MAX_MEMORY_IMPORTANCE}.`,
    );
  }

  return parsed;
}

/** Reject an impossible importance range before querying the memory store. */
export function validateMemoriesResourceImportanceRange(
  minImportance: number | undefined,
  maxImportance: number | undefined,
): void {
  if (!hasValidMemoryImportanceRange({ minImportance, maxImportance })) {
    throw new Error(INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE);
  }
}

/** Preserve memory resource filters when pagination links are generated. */
export function buildMemoriesResourceUri(
  minImportance: number | undefined,
  maxImportance: number | undefined,
  type?: MemoryType,
  tag?: string,
  search?: string,
  since?: string,
  until?: string,
): string {
  const params = new URLSearchParams();
  if (type !== undefined) params.set('type', type);
  if (tag !== undefined) params.set('tag', tag);
  if (search !== undefined) params.set('search', search);
  if (since !== undefined) params.set('since', since);
  if (until !== undefined) params.set('until', until);
  if (minImportance !== undefined) params.set('minImportance', String(minImportance));
  if (maxImportance !== undefined) params.set('maxImportance', String(maxImportance));
  const query = params.toString();
  return query.length > 0 ? `savestate://memories?${query}` : 'savestate://memories';
}
