import { z } from 'zod';
import {
  hasValidMemoryImportanceRange,
  INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
} from './memory-importance-range.js';

export const MemorySearchInputSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  minImportance: z.number().min(0).max(1).optional(),
  maxImportance: z.number().min(0).max(1).optional(),
}).refine(hasValidMemoryImportanceRange, {
  message: INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE,
  path: ['maxImportance'],
});
