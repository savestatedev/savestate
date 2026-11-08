import {
  hasValidMemoryImportanceRange,
  INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
} from './memory-importance-range.js';
import type { MemoryType } from '../memory/types.js';
import { normalizeMemorySource } from '../memory/source.js';

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

/** Parse an optional memory resource source without turning a blank filter into an unfiltered query. */
export function parseMemoriesResourceSource(value: string | null): string | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Invalid source value. Expected a non-empty source.');
  }

  return normalizeMemorySource(normalized);
}

/** Parse a namespace scope without allowing blank or multi-valued filters. */
export function parseMemoriesResourceNamespace(value: string | null): string | undefined {
  if (value === null) return undefined;

  const namespace = value.trim();
  const parts = namespace.split(':');
  if (
    namespace.length === 0 ||
    namespace.includes(',') ||
    /\s/.test(namespace) ||
    (parts.length !== 3 && parts.length !== 4) ||
    parts.some((part) => part.length === 0)
  ) {
    throw new Error(
      `Invalid namespace value "${value}". Expected a single non-empty namespace (org:app:agent[:user]).`,
    );
  }

  return namespace;
}

/** Parse the documented savestate://memories/{namespace} resource path. */
export function parseMemoriesResourcePath(pathname: string): string | undefined {
  if (pathname === '' || pathname === '/') return undefined;
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    throw new Error('Invalid memory resource path. Expected one namespace segment.');
  }

  let value: string;
  try {
    value = decodeURIComponent(pathname.slice(1));
  } catch {
    throw new Error('Invalid memory resource path. Expected an encoded namespace.');
  }

  if (value.includes('/')) {
    throw new Error('Invalid memory resource path. Expected one namespace segment.');
  }

  return parseMemoriesResourceNamespace(value);
}

/** Compare path and query namespace scopes using the same case-insensitive matching as storage. */
export function memoriesResourceNamespacesMatch(
  pathNamespace: string | undefined,
  queryNamespace: string | undefined,
): boolean {
  return (
    pathNamespace === undefined ||
    queryNamespace === undefined ||
    pathNamespace.toLowerCase() === queryNamespace.toLowerCase()
  );
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
const DECIMAL_IMPORTANCE_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/** Parse a memory resource importance query without silently widening its scope. */
export function parseMemoriesResourceImportance(
  value: string | null,
  name: 'minImportance' | 'maxImportance',
): number | undefined {
  if (value === null) return undefined;

  const normalized = value.trim();
  const parsed = DECIMAL_IMPORTANCE_PATTERN.test(normalized) ? Number(normalized) : Number.NaN;
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
  source?: string,
  namespace?: string,
  tag?: string,
  search?: string,
  since?: string,
  until?: string,
): string {
  const params = new URLSearchParams();
  if (type !== undefined) params.set('type', type);
  if (source !== undefined) params.set('source', source);
  if (tag !== undefined) params.set('tag', tag);
  if (search !== undefined) params.set('search', search);
  if (since !== undefined) params.set('since', since);
  if (until !== undefined) params.set('until', until);
  if (minImportance !== undefined) params.set('minImportance', String(minImportance));
  if (maxImportance !== undefined) params.set('maxImportance', String(maxImportance));
  const query = params.toString();
  const resource = namespace === undefined
    ? 'savestate://memories'
    : `savestate://memories/${encodeURIComponent(namespace)}`;
  return query.length > 0 ? `${resource}?${query}` : resource;
}

/** Echo every active resource filter so clients can verify the applied scope. */
export function formatMemoriesResourceFilters(
  type: MemoryType | undefined,
  source: string | undefined,
  namespace: string | undefined,
  tag: string | undefined,
  search: string | undefined,
  since: string | undefined,
  until: string | undefined,
  minImportance: number | undefined,
  maxImportance: number | undefined,
): {
  type: MemoryType | null;
  source: string | null;
  namespace: string | null;
  tag: string | null;
  search: string | null;
  since: string | null;
  until: string | null;
  minImportance: number | null;
  maxImportance: number | null;
} {
  return {
    type: type ?? null,
    source: source ?? null,
    namespace: namespace ?? null,
    tag: tag ?? null,
    search: search ?? null,
    since: since ?? null,
    until: until ?? null,
    minImportance: minImportance ?? null,
    maxImportance: maxImportance ?? null,
  };
}
