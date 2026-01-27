/**
 * SaveState Search
 *
 * Search across snapshot contents. Decrypts snapshots on-the-fly
 * and performs text matching across all stored data.
 */

import type { SaveStateConfig, SearchResult } from './types.js';

/**
 * Search across all snapshots for matching content.
 *
 * Decrypts and searches through:
 * - Memory entries
 * - Conversation messages
 * - Identity/personality documents
 * - Knowledge base documents
 *
 * @param query - Search query string
 * @param config - SaveState configuration
 * @param options - Search options
 * @returns Matching results sorted by relevance
 */
export async function searchSnapshots(
  query: string,
  config: SaveStateConfig,
  options?: {
    /** Only search specific snapshot IDs */
    snapshots?: string[];
    /** Only search specific content types */
    types?: ('memory' | 'conversation' | 'identity' | 'knowledge')[];
    /** Maximum number of results */
    limit?: number;
  },
): Promise<SearchResult[]> {
  const _limit = options?.limit ?? 20;

  // TODO: Implementation plan:
  // 1. List all snapshots (or filter to options.snapshots)
  // 2. For each snapshot, decrypt and unpack
  // 3. Search through content with text matching
  // 4. Score results by relevance
  // 5. Sort and return top N results

  void query;
  void config;
  void options;

  return [];
}

/**
 * Simple text relevance scoring.
 * Returns a score between 0 and 1.
 */
export function scoreMatch(query: string, content: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (!lowerContent.includes(lowerQuery)) return 0;

  // Exact match gets highest score
  if (lowerContent === lowerQuery) return 1;

  // Score based on frequency and position
  const words = lowerQuery.split(/\s+/);
  let matchedWords = 0;
  for (const word of words) {
    if (lowerContent.includes(word)) matchedWords++;
  }

  const wordScore = words.length > 0 ? matchedWords / words.length : 0;

  // Earlier matches score higher
  const position = lowerContent.indexOf(lowerQuery);
  const positionScore = Math.max(0, 1 - position / lowerContent.length);

  return wordScore * 0.7 + positionScore * 0.3;
}
