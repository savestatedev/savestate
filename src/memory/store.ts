/**
 * Memory Persistence Layer - Store
 * Issue #175: SQLite-backed encrypted memory storage
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { encrypt, decrypt, KeySource } from '../container/crypto.js';
import type { 
  MemoryEntry, 
  MemoryType, 
  MemoryQuery, 
  MemoryStats 
} from './types.js';

const DEFAULT_DB_PATH = join(homedir(), '.savestate', 'memory.db');

export interface MemoryStoreOptions {
  dbPath?: string;
  keySource?: KeySource;
  encryptionEnabled?: boolean;
}

export class MemoryStore {
  private db: Database.Database;
  private keySource?: KeySource;
  private encryptionEnabled: boolean;

  constructor(options: MemoryStoreOptions = {}) {
    const dbPath = options.dbPath || DEFAULT_DB_PATH;
    
    // Ensure directory exists
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.keySource = options.keySource;
    this.encryptionEnabled = options.encryptionEnabled ?? !!options.keySource;
    
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        importance REAL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        tags TEXT,
        encrypted INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
    `);
  }

  /**
   * Create a new memory entry
   */
  async create(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    let content = entry.content;
    let encrypted = 0;
    
    // Encrypt content if encryption is enabled
    if (this.encryptionEnabled && this.keySource) {
      const encryptedBuffer = await encrypt(Buffer.from(content), this.keySource);
      content = encryptedBuffer.toString('base64');
      encrypted = 1;
    }

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, type, content, metadata, importance, created_at, updated_at, expires_at, tags, encrypted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      entry.type,
      content,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.importance ?? 0.5,
      now,
      now,
      entry.expiresAt || null,
      entry.tags ? JSON.stringify(entry.tags) : null,
      encrypted
    );

    return {
      id,
      type: entry.type,
      content: entry.content, // Return original content
      metadata: entry.metadata,
      importance: entry.importance ?? 0.5,
      createdAt: now,
      updatedAt: now,
      expiresAt: entry.expiresAt,
      tags: entry.tags,
    };
  }

  /**
   * Get a memory entry by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.rowToEntry(row);
  }

  /**
   * Update a memory entry
   */
  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    let content = updates.content ?? existing.content;
    let encrypted = 0;

    // Re-encrypt if content changed and encryption is enabled
    if (updates.content && this.encryptionEnabled && this.keySource) {
      const encryptedBuffer = await encrypt(Buffer.from(content), this.keySource);
      content = encryptedBuffer.toString('base64');
      encrypted = 1;
    }

    const stmt = this.db.prepare(`
      UPDATE memories 
      SET content = ?, metadata = ?, importance = ?, updated_at = ?, expires_at = ?, tags = ?, encrypted = ?
      WHERE id = ?
    `);

    stmt.run(
      content,
      updates.metadata ? JSON.stringify(updates.metadata) : (existing.metadata ? JSON.stringify(existing.metadata) : null),
      updates.importance ?? existing.importance,
      now,
      updates.expiresAt ?? existing.expiresAt ?? null,
      updates.tags ? JSON.stringify(updates.tags) : (existing.tags ? JSON.stringify(existing.tags) : null),
      encrypted,
      id
    );

    return this.get(id);
  }

  /**
   * Delete a memory entry
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Query memory entries
   */
  async query(query: MemoryQuery = {}): Promise<MemoryEntry[]> {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: any[] = [];

    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.minImportance !== undefined) {
      sql += ' AND importance >= ?';
      params.push(query.minImportance);
    }

    if (query.since) {
      sql += ' AND created_at >= ?';
      params.push(query.since);
    }

    if (query.until) {
      sql += ' AND created_at <= ?';
      params.push(query.until);
    }

    if (query.tags && query.tags.length > 0) {
      // Simple tag matching - check if any tag exists in the tags JSON
      const tagConditions = query.tags.map(() => "tags LIKE ?");
      sql += ` AND (${tagConditions.join(' OR ')})`;
      params.push(...query.tags.map(tag => `%"${tag}"%`));
    }

    if (query.search) {
      sql += ' AND content LIKE ?';
      params.push(`%${query.search}%`);
    }

    sql += ' ORDER BY importance DESC, created_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    const entries: MemoryEntry[] = [];
    for (const row of rows) {
      entries.push(await this.rowToEntry(row));
    }
    return entries;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
    const total = (totalStmt.get() as any).count;

    const byTypeStmt = this.db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type');
    const byTypeRows = byTypeStmt.all() as any[];
    const byType: Record<MemoryType, number> = {
      fact: 0,
      event: 0,
      preference: 0,
      conversation: 0,
    };
    for (const row of byTypeRows) {
      byType[row.type as MemoryType] = row.count;
    }

    const rangeStmt = this.db.prepare('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM memories');
    const range = rangeStmt.get() as any;

    return {
      totalEntries: total,
      byType,
      oldestEntry: range?.oldest,
      newestEntry: range?.newest,
    };
  }

  /**
   * Clear all memories (use with caution!)
   */
  clear(): void {
    this.db.exec('DELETE FROM memories');
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Convert a database row to a MemoryEntry
   */
  private async rowToEntry(row: any): Promise<MemoryEntry> {
    let content = row.content;
    
    // Decrypt if encrypted
    if (row.encrypted && this.keySource) {
      const encryptedBuffer = Buffer.from(content, 'base64');
      const decryptedBuffer = await decrypt(encryptedBuffer, this.keySource);
      content = decryptedBuffer.toString();
    }

    return {
      id: row.id,
      type: row.type as MemoryType,
      content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      importance: row.importance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
    };
  }
}
