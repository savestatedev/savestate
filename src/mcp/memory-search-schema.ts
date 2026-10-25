import { z } from 'zod';
import {
  hasValidMemoryImportanceRange,
  INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
} from './memory-importance-range.js';
import {
  parseMemoriesResourceDate,
  validateMemoriesResourceDateRange,
} from './memories-resource-filters.js';

export const MemorySearchInputSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  source: z.string().trim().min(1).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  minImportance: z.number().min(0).max(1).optional(),
  maxImportance: z.number().min(0).max(1).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
}).refine(hasValidMemoryImportanceRange, {
  message: INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
  path: ['maxImportance'],
});

/** Normalize inclusive creation bounds shared by both MCP memory search tools. */
export function parseMemorySearchDateFilters(input: {
  since?: string;
  until?: string;
}): { since?: string; until?: string } {
  const since = parseMemoriesResourceDate(input.since ?? null, 'since');
  const until = parseMemoriesResourceDate(input.until ?? null, 'until');
  validateMemoriesResourceDateRange(since, until);
  return { since, until };
}
