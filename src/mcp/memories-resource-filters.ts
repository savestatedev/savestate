import {
  hasValidMemoryImportanceRange,
  INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
} from './memory-importance-range.js';

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
): string {
  const params = new URLSearchParams();
  if (minImportance !== undefined) params.set('minImportance', String(minImportance));
  if (maxImportance !== undefined) params.set('maxImportance', String(maxImportance));
  const query = params.toString();
  return query.length > 0 ? `savestate://memories?${query}` : 'savestate://memories';
}
