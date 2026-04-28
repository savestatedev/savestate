/**
 * Trust Store
 *
 * Issue #65: Staged Memory Promotion Engine (Trust Kernel)
 *
 * SQLite-backed storage for trust entries with state machine enforcement.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type {
  TrustEntry,
  TrustState,
  PromotionScope,
  TransitionEvent,
  TrustMetrics,
} from './types.js';

const DEFAULT_DB_PATH = join(homedir(), '.savestate', 'trust.db');

// Valid state transitions
const VALID_TRANSITIONS: Record<TrustState, TrustState[]> = {
  candidate: ['stable', 'rejected', 'quarantined'],
  stable: ['revoked', 'quarantined'],
  rejected: [], // Terminal state
  quarantined: ['candidate', 'rejected'], // Can be re-evaluated or rejected
  revoked: [], // Terminal state (denylist)
};

export interface TrustStoreOptions {
  dbPath?: string;
}

export class TrustStore {
  private db: Database.Database;

  constructor(options: TrustStoreOptions = {}) {
    const dbPath = options.dbPath || DEFAULT_DB_PATH;

    // Ensure directory exists
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Trust entries table
      CREATE TABLE IF NOT EXISTS trust_entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'candidate',
        scope TEXT NOT NULL DEFAULT 'semantic',
        confidence REAL NOT NULL DEFAULT 0.5,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        state_changed_at TEXT NOT NULL,
        ttl_seconds INTEGER,
        expires_at TEXT,
        tags TEXT,
        metadata TEXT
      );

      -- Transition events table (audit trail)
      CREATE TABLE IF NOT EXISTS transition_events (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        reason TEXT NOT NULL,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (entry_id) REFERENCES trust_entries(id)
      );

      -- Denylist table
      CREATE TABLE IF NOT EXISTS denylist (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        reason TEXT NOT NULL,
        added_at TEXT NOT NULL,
        added_by TEXT NOT NULL,
        epoch INTEGER NOT NULL DEFAULT 1
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_trust_state ON trust_entries(state);
      CREATE INDEX IF NOT EXISTS idx_trust_scope ON trust_entries(scope);
      CREATE INDEX IF NOT EXISTS idx_trust_confidence ON trust_entries(confidence);
      CREATE INDEX IF NOT EXISTS idx_trust_expires ON trust_entries(expires_at);
      CREATE INDEX IF NOT EXISTS idx_transition_entry ON transition_events(entry_id);
      CREATE INDEX IF NOT EXISTS idx_transition_timestamp ON transition_events(timestamp);
    `);
  }

  /**
   * Create a new trust entry (always starts as candidate).
   */
  create(entry: Omit<TrustEntry, 'id' | 'createdAt' | 'stateChangedAt' | 'state'>): TrustEntry {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Calculate expiration if TTL is set
    let expiresAt: string | undefined;
    if (entry.ttlSeconds) {
      const expiry = new Date(Date.now() + entry.ttlSeconds * 1000);
      expiresAt = expiry.toISOString();
    }

    const stmt = this.db.prepare(`
      INSERT INTO trust_entries (
        id, content, state, scope, confidence, source,
        created_at, state_changed_at, ttl_seconds, expires_at, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      entry.content,
      'candidate', // Always start as candidate
      entry.scope,
      entry.confidence,
      entry.source,
      now,
      now,
      entry.ttlSeconds ?? null,
      expiresAt ?? null,
      entry.tags ? JSON.stringify(entry.tags) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    );

    return {
      id,
      content: entry.content,
      state: 'candidate',
      scope: entry.scope,
      confidence: entry.confidence,
      source: entry.source,
      createdAt: now,
      stateChangedAt: now,
      ttlSeconds: entry.ttlSeconds,
      expiresAt,
      tags: entry.tags,
      metadata: entry.metadata,
    };
  }

  /**
   * Get a trust entry by ID.
   */
  get(id: string): TrustEntry | null {
    const stmt = this.db.prepare('SELECT * FROM trust_entries WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;
    return this.rowToEntry(row);
  }

  /**
   * Transition an entry to a new state.
   * Validates the transition against the state machine.
   */
  transition(
    id: string,
    toState: TrustState,
    reason: string,
    actor: string
  ): { success: boolean; error?: string; event?: TransitionEvent } {
    const entry = this.get(id);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    const fromState = entry.state;

    // Validate transition
    if (!VALID_TRANSITIONS[fromState].includes(toState)) {
      return {
        success: false,
        error: `Invalid transition: ${fromState} → ${toState}`,
      };
    }

    const now = new Date().toISOString();
    const eventId = randomUUID();

    // Update entry state
    const updateStmt = this.db.prepare(`
      UPDATE trust_entries
      SET state = ?, state_changed_at = ?
      WHERE id = ?
    `);
    updateStmt.run(toState, now, id);

    // Record transition event
    const eventStmt = this.db.prepare(`
      INSERT INTO transition_events (id, entry_id, from_state, to_state, reason, actor, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    eventStmt.run(eventId, id, fromState, toState, reason, actor, now);

    const event: TransitionEvent = {
      id: eventId,
      entryId: id,
      fromState,
      toState,
      reason,
      actor,
      timestamp: now,
    };

    return { success: true, event };
  }

  /**
   * Query entries by state and/or scope.
   */
  query(options: {
    state?: TrustState;
    scope?: PromotionScope;
    minConfidence?: number;
    limit?: number;
    includeExpired?: boolean;
  } = {}): TrustEntry[] {
    let sql = 'SELECT * FROM trust_entries WHERE 1=1';
    const params: any[] = [];

    if (options.state) {
      sql += ' AND state = ?';
      params.push(options.state);
    }

    if (options.scope) {
      sql += ' AND scope = ?';
      params.push(options.scope);
    }

    if (options.minConfidence !== undefined) {
      sql += ' AND confidence >= ?';
      params.push(options.minConfidence);
    }

    if (!options.includeExpired) {
      sql += " AND (expires_at IS NULL OR expires_at > datetime('now'))";
    }

    sql += ' ORDER BY confidence DESC, created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Get entries ready for promotion evaluation.
   */
  getCandidatesForPromotion(minAgeSeconds: number = 0): TrustEntry[] {
    const cutoff = new Date(Date.now() - minAgeSeconds * 1000).toISOString();

    const stmt = this.db.prepare(`
      SELECT * FROM trust_entries
      WHERE state = 'candidate'
        AND scope != 'episodic'
        AND created_at <= ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY confidence DESC
    `);

    const rows = stmt.all(cutoff) as any[];
    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Get transition history for an entry.
   */
  getTransitionHistory(entryId: string): TransitionEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transition_events
      WHERE entry_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(entryId) as any[];
    return rows.map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      fromState: row.from_state,
      toState: row.to_state,
      reason: row.reason,
      actor: row.actor,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Add a pattern to the denylist.
   */
  addToDenylist(pattern: string, reason: string, addedBy: string): void {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Get current epoch
    const epochRow = this.db.prepare('SELECT MAX(epoch) as max_epoch FROM denylist').get() as any;
    const epoch = (epochRow?.max_epoch ?? 0) + 1;

    const stmt = this.db.prepare(`
      INSERT INTO denylist (id, pattern, reason, added_at, added_by, epoch)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, pattern, reason, now, addedBy, epoch);
  }

  /**
   * Check if content matches any denylist pattern.
   */
  isDenylisted(content: string): { denied: boolean; pattern?: string; reason?: string } {
    const stmt = this.db.prepare('SELECT * FROM denylist');
    const rows = stmt.all() as any[];

    for (const row of rows) {
      // Simple substring match for now; could be extended to regex
      if (content.toLowerCase().includes(row.pattern.toLowerCase())) {
        return { denied: true, pattern: row.pattern, reason: row.reason };
      }
    }

    return { denied: false };
  }

  /**
   * Get current denylist epoch.
   */
  getDenylistEpoch(): number {
    const row = this.db.prepare('SELECT MAX(epoch) as max_epoch FROM denylist').get() as any;
    return row?.max_epoch ?? 0;
  }

  /**
   * Get trust metrics.
   */
  getMetrics(): TrustMetrics {
    // Entries by state
    const stateRows = this.db
      .prepare('SELECT state, COUNT(*) as count FROM trust_entries GROUP BY state')
      .all() as any[];
    const entriesByState: Record<TrustState, number> = {
      candidate: 0,
      stable: 0,
      rejected: 0,
      quarantined: 0,
      revoked: 0,
    };
    for (const row of stateRows) {
      entriesByState[row.state as TrustState] = row.count;
    }

    // Entries by scope
    const scopeRows = this.db
      .prepare('SELECT scope, COUNT(*) as count FROM trust_entries GROUP BY scope')
      .all() as any[];
    const entriesByScope: Record<PromotionScope, number> = {
      semantic: 0,
      procedural: 0,
      episodic: 0,
    };
    for (const row of scopeRows) {
      entriesByScope[row.scope as PromotionScope] = row.count;
    }

    // Promotions last hour
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const promotions = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM transition_events
         WHERE to_state = 'stable' AND timestamp > ?`
      )
      .get(hourAgo) as any;

    // Rejections last hour
    const rejections = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM transition_events
         WHERE to_state = 'rejected' AND timestamp > ?`
      )
      .get(hourAgo) as any;

    // Denylist size
    const denylistSize = this.db.prepare('SELECT COUNT(*) as count FROM denylist').get() as any;

    return {
      entriesByState,
      entriesByScope,
      promotionsLastHour: promotions?.count ?? 0,
      rejectionsLastHour: rejections?.count ?? 0,
      avgPromotionLatencyMs: 0, // Would need to track this separately
      writeGateP95Ms: 0,
      actionGateP95Ms: 0,
      denylistSize: denylistSize?.count ?? 0,
      criticalBreaches: 0,
    };
  }

  /**
   * Clean up expired entries.
   */
  cleanupExpired(): number {
    const result = this.db.prepare(`
      DELETE FROM trust_entries
      WHERE expires_at IS NOT NULL
        AND expires_at <= datetime("now")
    `).run();

    return result.changes;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }

  private rowToEntry(row: any): TrustEntry {
    return {
      id: row.id,
      content: row.content,
      state: row.state,
      scope: row.scope,
      confidence: row.confidence,
      source: row.source,
      createdAt: row.created_at,
      stateChangedAt: row.state_changed_at,
      ttlSeconds: row.ttl_seconds ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
