/**
 * SaveState Search
 *
 * Search across snapshot contents. Decrypts snapshots on-the-fly
 * and performs text matching across all stored data.
 */

import type { SaveStateConfig, SearchResult, Snapshot } from './types.js';
import type { SnapshotIndexEntry } from './index-file.js';
import { loadIndex } from './index-file.js';
import { resolveStorage } from './storage/index.js';
import { decrypt } from './encryption.js';
import { unpackFromArchive, unpackSnapshot } from './format.js';
import { isIncremental, reconstructFromChain } from './incremental.js';
import { createHash } from 'node:crypto';

type SearchType = 'memory' | 'conversation' | 'identity' | 'knowledge';

const DEFAULT_LIMIT = 20;
const CONTEXT_RADIUS = 60;

/**
 * Per-process LRU cache of decrypted snapshots, keyed by snapshot id +
 * passphrase fingerprint. Same-process repeat searches skip decrypt + unpack.
 * Bounded to 32 entries to keep RSS sane on big indexes.
 */
const SNAPSHOT_CACHE_LIMIT = 32;
const snapshotCache = new Map<string, Snapshot>();

function cacheKey(snapshotId: string, passphrase: string): string {
  const fp = createHash('sha256').update(passphrase).digest('hex').slice(0, 12);
  return `${snapshotId}:${fp}`;
}

function cacheGet(key: string): Snapshot | undefined {
  const hit = snapshotCache.get(key);
  if (hit) {
    snapshotCache.delete(key);
    snapshotCache.set(key, hit);
  }
  return hit;
}

function cachePut(key: string, value: Snapshot): void {
  if (snapshotCache.has(key)) snapshotCache.delete(key);
  snapshotCache.set(key, value);
  while (snapshotCache.size > SNAPSHOT_CACHE_LIMIT) {
    const oldest = snapshotCache.keys().next().value;
    if (oldest) snapshotCache.delete(oldest);
  }
}

/** Test/dev helper: drop the in-process snapshot cache. */
export function clearSnapshotCache(): void {
  snapshotCache.clear();
}

export interface SearchOptions {
  /** Only search specific snapshot IDs */
  snapshots?: string[];
  /** Only search specific content types */
  types?: SearchType[];
  /** Maximum number of results */
  limit?: number;
  /** Decryption passphrase (overrides SAVESTATE_PASSPHRASE) */
  passphrase?: string;
}

/**
 * Search across all snapshots for matching content.
 *
 * Decrypts and searches through:
 * - Memory entries
 * - Conversation messages (index titles)
 * - Identity/personality documents
 * - Knowledge base documents (metadata only)
 */
export async function searchSnapshots(
  query: string,
  config: SaveStateConfig,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  const limit = options?.limit ?? DEFAULT_LIMIT;
  const types = options?.types;
  const passphrase = options?.passphrase ?? process.env.SAVESTATE_PASSPHRASE;
  if (!passphrase) {
    throw new Error(
      'No passphrase available. Set SAVESTATE_PASSPHRASE or pass options.passphrase.',
    );
  }

  const index = await loadIndex();
  const targets: SnapshotIndexEntry[] = options?.snapshots
    ? index.snapshots.filter((s) => options.snapshots!.includes(s.id))
    : index.snapshots;

  if (targets.length === 0) return [];

  const storage = resolveStorage(config);
  const results: SearchResult[] = [];

  for (const entry of targets) {
    const key = cacheKey(entry.id, passphrase);
    let snapshot = cacheGet(key);
    if (!snapshot) {
      let fileMap;
      try {
        const encrypted = await storage.get(entry.filename);
        const archive = await decrypt(encrypted, passphrase);
        fileMap = await unpackFromArchive(archive);
        if (isIncremental(fileMap)) {
          fileMap = await reconstructFromChain(entry.id, storage, passphrase);
        }
      } catch {
        // Skip snapshots we cannot decrypt or load — wrong passphrase, missing parents, etc.
        continue;
      }
      snapshot = unpackSnapshot(fileMap);
      cachePut(key, snapshot);
    }
    const includeMemory = !types || types.includes('memory');
    const includeIdentity = !types || types.includes('identity');
    const includeConversation = !types || types.includes('conversation');
    const includeKnowledge = !types || types.includes('knowledge');

    if (includeMemory) {
      for (const mem of snapshot.memory.core) {
        const score = scoreMatch(query, mem.content);
        if (score > 0) {
          results.push({
            snapshotId: entry.id,
            snapshotTimestamp: entry.timestamp,
            type: 'memory',
            content: mem.content,
            context: extractContext(query, mem.content),
            score,
            path: `memory/core.json#${mem.id}`,
          });
        }
      }
    }

    if (includeIdentity && snapshot.identity.personality) {
      const score = scoreMatch(query, snapshot.identity.personality);
      if (score > 0) {
        results.push({
          snapshotId: entry.id,
          snapshotTimestamp: entry.timestamp,
          type: 'identity',
          content: snapshot.identity.personality,
          context: extractContext(query, snapshot.identity.personality),
          score,
          path: 'identity/personality.md',
        });
      }
    }

    if (includeConversation) {
      for (const conv of snapshot.conversations.conversations) {
        const haystack = conv.title ?? '';
        const score = scoreMatch(query, haystack);
        if (score > 0) {
          results.push({
            snapshotId: entry.id,
            snapshotTimestamp: entry.timestamp,
            type: 'conversation',
            content: haystack,
            context: extractContext(query, haystack),
            score,
            path: conv.path,
          });
        }
      }
    }

    if (includeKnowledge) {
      for (const doc of snapshot.memory.knowledge) {
        const haystack = doc.filename;
        const score = scoreMatch(query, haystack);
        if (score > 0) {
          results.push({
            snapshotId: entry.id,
            snapshotTimestamp: entry.timestamp,
            type: 'knowledge',
            content: haystack,
            context: undefined,
            score,
            path: doc.path,
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Simple text relevance scoring.
 * Returns a score between 0 and 1.
 */
export function scoreMatch(query: string, content: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (!lowerContent.includes(lowerQuery)) {
    // Allow partial word-level matches when full phrase is absent.
    const words = lowerQuery.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    let matched = 0;
    for (const word of words) if (lowerContent.includes(word)) matched++;
    if (matched === 0) return 0;
    return (matched / words.length) * 0.4;
  }

  if (lowerContent === lowerQuery) return 1;

  const words = lowerQuery.split(/\s+/).filter(Boolean);
  let matchedWords = 0;
  for (const word of words) if (lowerContent.includes(word)) matchedWords++;
  const wordScore = words.length > 0 ? matchedWords / words.length : 0;

  const position = lowerContent.indexOf(lowerQuery);
  const positionScore = Math.max(0, 1 - position / Math.max(lowerContent.length, 1));

  return wordScore * 0.7 + positionScore * 0.3;
}

function extractContext(query: string, content: string): string | undefined {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return undefined;
  const start = Math.max(0, idx - CONTEXT_RADIUS);
  const end = Math.min(content.length, idx + query.length + CONTEXT_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end)}${suffix}`;
}
