export interface MemoryImportanceRange {
  minImportance?: number;
  maxImportance?: number;
}

/** Reject ranges that cannot match any memory before querying the store. */
export function hasValidMemoryImportanceRange({
  minImportance,
  maxImportance,
}: MemoryImportanceRange): boolean {
  return minImportance === undefined ||
    maxImportance === undefined ||
    minImportance <= maxImportance;
}

export const INVALID_MEMORY_IMPORTANCE_RANGE_MESSAGE =
  'minImportance must be at or below maxImportance';
