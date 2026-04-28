/**
 * SaveState Search Index Builder
 *
 * Builds a per-snapshot inverted index over the searchable text in a
 * Snapshot so that `searchSnapshots` can pre-filter postings by query
 * tokens instead of scanning every memory entry.
 *
 * The index is JSON-serialized and packed into the encrypted SAF
 * archive at `search/index.json`, so it inherits end-to-end encryption
 * from the SAF and needs no separate key system.
 *
 * Format is intentionally simple — `Record<token, posting[]>` — so we
 * can iterate later without breaking legacy snapshots.
 */

import type {
  Snapshot,
  SearchIndexFile,
  SearchIndexPosting,
  SearchIndexPostingType,
} from '../types.js';

/** Current search index format version. */
export const SEARCH_INDEX_VERSION = '0.1.0';

/** Minimum token length kept in the index. */
const MIN_TOKEN_LENGTH = 2;

/** Token splitter: anything that isn't [a-z0-9] separates tokens. */
const TOKEN_SPLIT_RE = /[^a-z0-9]+/;

/**
 * Build a search index for a snapshot.
 *
 * Tokenizes content from:
 * - memory.core entries (id → content)
 * - identity.personality (single document)
 * - conversations index (titles)
 * - knowledge documents (filenames)
 *
 * Lower-cases, splits on `/[^a-z0-9]+/`, drops tokens shorter than 2
 * chars. Postings are de-duplicated per token by (type, sourceId, path).
 *
 * The output is fully deterministic for the same input: tokens are
 * emitted in sorted order and postings within each token are sorted by
 * (type, sourceId, path).
 */
export function buildSearchIndex(snapshot: Snapshot): SearchIndexFile {
  const postings = new Map<string, Map<string, SearchIndexPosting>>();

  const add = (token: string, posting: SearchIndexPosting): void => {
    let bucket = postings.get(token);
    if (!bucket) {
      bucket = new Map<string, SearchIndexPosting>();
      postings.set(token, bucket);
    }
    const key = `${posting.type}\0${posting.sourceId}\0${posting.path}`;
    if (!bucket.has(key)) {
      bucket.set(key, posting);
    }
  };

  const indexText = (
    text: string,
    type: SearchIndexPostingType,
    sourceId: string,
    path: string,
  ): void => {
    for (const token of tokenize(text)) {
      add(token, { type, sourceId, path });
    }
  };

  // memory.core
  for (const mem of snapshot.memory.core) {
    indexText(mem.content, 'memory', mem.id, `memory/core.json#${mem.id}`);
  }

  // identity.personality (single document — sourceId is the path itself)
  if (snapshot.identity.personality) {
    indexText(
      snapshot.identity.personality,
      'identity',
      'identity/personality.md',
      'identity/personality.md',
    );
  }

  // conversations (titles only — that's what searchSnapshots scans)
  for (const conv of snapshot.conversations.conversations) {
    if (conv.title) {
      indexText(conv.title, 'conversation', conv.id, conv.path);
    }
  }

  // knowledge (filenames only — same as searchSnapshots)
  for (const doc of snapshot.memory.knowledge) {
    indexText(doc.filename, 'knowledge', doc.id, doc.path);
  }

  // Serialize deterministically: sort tokens, sort postings within each token.
  const tokens: SearchIndexFile['tokens'] = {};
  const sortedTokens = [...postings.keys()].sort();
  for (const token of sortedTokens) {
    const bucket = postings.get(token)!;
    const list = [...bucket.values()].sort(comparePostings);
    tokens[token] = list;
  }

  return {
    version: SEARCH_INDEX_VERSION,
    tokens,
  };
}

/**
 * Tokenize a string the same way the index does.
 *
 * Exposed for callers that need to apply the same tokenization to
 * query strings (e.g. searchSnapshots' pre-filter step).
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(TOKEN_SPLIT_RE)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

function comparePostings(a: SearchIndexPosting, b: SearchIndexPosting): number {
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return 0;
}
