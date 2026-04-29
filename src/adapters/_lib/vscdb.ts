/**
 * Shared utilities for reading VS Code-style `state.vscdb` SQLite databases.
 *
 * Cursor, Windsurf, and other VS Code forks all use the same on-disk format:
 * a single-table SQLite file (`ItemTable`) keyed by string with JSON-encoded
 * values. The exact key namespaces differ between vendors (Cursor uses
 * `composer.*`, Windsurf uses `cascade.*`), so callers pass a list of
 * key patterns to look up.
 *
 * v1 deliberately stays read-only. We never write back into Cursor/Windsurf
 * databases on restore — we recreate config + rules files only, since
 * pushing fabricated rows into a live IDE's local state risks corrupting
 * the user's session.
 */

import Database from 'better-sqlite3';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Conversation, ConversationMeta, Message } from '../../types.js';

/**
 * A best-effort parsed row from `ItemTable`. Value is JSON-decoded if
 * possible; otherwise it's the raw string.
 */
export interface VscdbRow {
  key: string;
  value: unknown;
}

/**
 * Extract rows from `ItemTable` whose key matches any of the given prefixes
 * (string `startsWith`). Returns an empty array if the file doesn't exist
 * or can't be opened.
 */
export function readVscdbRows(dbPath: string, keyPrefixes: string[]): VscdbRow[] {
  if (!existsSync(dbPath)) return [];

  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return [];
  }

  try {
    const rows = db
      .prepare('SELECT key, value FROM ItemTable')
      .all() as Array<{ key: string; value: string | Buffer }>;

    const out: VscdbRow[] = [];
    for (const row of rows) {
      if (!keyPrefixes.some((p) => row.key.startsWith(p))) continue;
      const raw = typeof row.value === 'string' ? row.value : row.value.toString('utf-8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      out.push({ key: row.key, value: parsed });
    }
    return out;
  } catch {
    // Schema differs across versions; skip silently.
    return [];
  } finally {
    db.close();
  }
}

/**
 * Walk a workspaceStorage root and return the list of `state.vscdb` paths
 * present under each per-workspace hash directory. Used by Cursor and
 * Windsurf to enumerate which DBs to inspect.
 */
export function listWorkspaceDbs(workspaceStorageRoot: string): string[] {
  if (!existsSync(workspaceStorageRoot)) return [];
  const paths: string[] = [];
  for (const entry of readdirSync(workspaceStorageRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dbPath = join(workspaceStorageRoot, entry.name, 'state.vscdb');
    try {
      const s = statSync(dbPath);
      if (s.isFile()) paths.push(dbPath);
    } catch {
      // missing — skip
    }
  }
  return paths;
}

/**
 * Default macOS workspaceStorage root for a VS Code fork by display name.
 * Returns null if the path doesn't exist on this machine.
 */
export function macWorkspaceStorageRoot(appName: string): string | null {
  const root = join(homedir(), 'Library', 'Application Support', appName, 'User', 'workspaceStorage');
  return existsSync(root) ? root : null;
}

/**
 * Convert a free-form JSON object that *looks like* a chat session into
 * SaveState `Conversation` shape. We're intentionally lenient: if the input
 * has any of the common shapes we've seen in Cursor / Windsurf vscdb
 * payloads, we extract; otherwise we return null and caller drops the row.
 *
 * Recognized shapes:
 *  1. `{ id, title?, messages: [{ role, content, timestamp? }, ...] }`
 *  2. `{ id, title?, conversation: [...] }`
 *  3. `{ tabs: [{ id, title?, messages: [...] }] }` — wraps multiple sessions
 *  4. `{ chats: [{ id, ... }] }` — wraps multiple sessions
 */
export function coerceConversations(
  value: unknown,
  source: string,
): Conversation[] {
  if (value == null || typeof value !== 'object') return [];

  // Wrapper shapes — recurse into each child.
  const wrappers: Array<keyof any> = ['tabs', 'chats', 'sessions', 'conversations'];
  for (const w of wrappers) {
    const arr = (value as Record<string, unknown>)[w as string];
    if (Array.isArray(arr)) {
      return arr.flatMap((child) => coerceConversations(child, source));
    }
  }

  // Single-conversation shape.
  const obj = value as Record<string, unknown>;
  const messages =
    (Array.isArray(obj.messages) && obj.messages) ||
    (Array.isArray(obj.conversation) && obj.conversation) ||
    null;
  if (!messages) return [];

  const id = typeof obj.id === 'string' ? obj.id : `${source}-${Math.random().toString(36).slice(2, 10)}`;
  const title = typeof obj.title === 'string' ? obj.title : undefined;
  const createdAt = typeof obj.createdAt === 'string' ? obj.createdAt : new Date(0).toISOString();
  const updatedAt = typeof obj.updatedAt === 'string' ? obj.updatedAt : createdAt;

  const out: Message[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const mm = m as Record<string, unknown>;
    const role = normalizeRole(mm.role);
    const content =
      typeof mm.content === 'string'
        ? mm.content
        : typeof mm.text === 'string'
          ? mm.text
          : null;
    if (content === null) continue;
    out.push({
      id: typeof mm.id === 'string' ? mm.id : `${id}-${out.length}`,
      role,
      content,
      timestamp:
        typeof mm.timestamp === 'string'
          ? mm.timestamp
          : typeof mm.createdAt === 'string'
            ? mm.createdAt
            : createdAt,
    });
  }

  if (out.length === 0) return [];

  return [
    {
      id,
      title,
      createdAt,
      updatedAt,
      messages: out,
      metadata: { source },
    },
  ];
}

function normalizeRole(value: unknown): Message['role'] {
  if (value === 'user' || value === 'assistant' || value === 'system' || value === 'tool') {
    return value;
  }
  if (value === 'human') return 'user';
  if (value === 'ai' || value === 'bot') return 'assistant';
  return 'assistant';
}

/**
 * Convert an array of `Conversation` objects into the SaveState index +
 * threads pair that snapshots use. The `threads` map is keyed by relative
 * path so adapters can attach the threads under a per-adapter prefix.
 */
export function buildConversationsIndex(
  conversations: Conversation[],
  pathPrefix: string,
): { index: { total: number; conversations: ConversationMeta[] }; threads: Record<string, string> } {
  const meta: ConversationMeta[] = [];
  const threads: Record<string, string> = {};

  for (const conv of conversations) {
    const relPath = `${pathPrefix}/${safeFilename(conv.id)}.json`;
    threads[relPath] = JSON.stringify(conv, null, 2);
    meta.push({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages.length,
      path: relPath,
    });
  }

  return {
    index: { total: meta.length, conversations: meta },
    threads,
  };
}

function safeFilename(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 80);
}
