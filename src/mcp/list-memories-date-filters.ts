import {
  parseMemoriesResourceDate,
  validateMemoriesResourceDateRange,
} from './memories-resource-filters.js';

/** Normalize inclusive creation bounds for the OpenMemory-compatible list tool. */
export function parseListMemoriesDateFilters(input: {
  since?: string;
  until?: string;
}): { since?: string; until?: string } {
  const since = parseMemoriesResourceDate(input.since ?? null, 'since');
  const until = parseMemoriesResourceDate(input.until ?? null, 'until');
  validateMemoriesResourceDateRange(since, until);
  return { since, until };
}
