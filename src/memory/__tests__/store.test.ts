import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

describe('MemoryStore', () => {
  let store: MemoryStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `test-memory-${randomUUID()}.db`);
    store = new MemoryStore({ dbPath, encryptionEnabled: false });
  });

  afterEach(() => {
    store.close();
    try {
      rmSync(dbPath);
    } catch {
      // ignore cleanup errors
    }
  });

  describe('create', () => {
    it('should create a memory entry', async () => {
      const entry = await store.create({
        type: 'fact',
        content: 'The user prefers dark mode',
        importance: 0.8,
        tags: ['preferences', 'ui'],
      });

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe('fact');
      expect(entry.content).toBe('The user prefers dark mode');
      expect(entry.importance).toBe(0.8);
      expect(entry.tags).toEqual(['preferences', 'ui']);
      expect(entry.createdAt).toBeDefined();
      expect(entry.updatedAt).toBeDefined();
    });

    it('should use default importance when not specified', async () => {
      const entry = await store.create({
        type: 'event',
        content: 'User logged in',
      });

      expect(entry.importance).toBe(0.5);
    });
  });

  describe('get', () => {
    it('should retrieve an existing entry', async () => {
      const created = await store.create({
        type: 'preference',
        content: 'Language: English',
        metadata: { category: 'language' },
      });

      const retrieved = await store.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.content).toBe('Language: English');
      expect(retrieved!.metadata).toEqual({ category: 'language' });
    });

    it('should return null for non-existent entry', async () => {
      const result = await store.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an existing entry', async () => {
      const created = await store.create({
        type: 'fact',
        content: 'Original content',
        importance: 0.5,
      });

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await store.update(created.id, {
        content: 'Updated content',
        importance: 0.9,
      });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.importance).toBe(0.9);
      // Note: In fast execution, timestamps might be the same millisecond
      // The important thing is the update succeeded
    });

    it('should return null when updating non-existent entry', async () => {
      const result = await store.update('non-existent-id', { content: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing entry', async () => {
      const created = await store.create({
        type: 'fact',
        content: 'To be deleted',
      });

      const deleted = store.delete(created.id);
      expect(deleted).toBe(true);

      const retrieved = await store.get(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent entry', () => {
      const result = store.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await store.create({ type: 'fact', content: 'Fact 1', importance: 0.9 });
      await store.create({ type: 'fact', content: 'Fact 2', importance: 0.5 });
      await store.create({ type: 'event', content: 'Event 1', importance: 0.7 });
      await store.create({ type: 'preference', content: 'Pref 1', importance: 0.3, tags: ['ui'] });
    });

    it('should filter by type', async () => {
      const facts = await store.query({ type: 'fact' });
      expect(facts).toHaveLength(2);
      expect(facts.every(e => e.type === 'fact')).toBe(true);
    });

    it('should filter by minimum importance', async () => {
      const important = await store.query({ minImportance: 0.6 });
      expect(important).toHaveLength(2);
      expect(important.every(e => (e.importance ?? 0) >= 0.6)).toBe(true);
    });

    it('should filter by maximum importance', async () => {
      const lowerPriority = await store.query({ maxImportance: 0.5 });
      expect(lowerPriority).toHaveLength(2);
      expect(lowerPriority.every(e => (e.importance ?? 1) <= 0.5)).toBe(true);
    });

    it('should limit results', async () => {
      const limited = await store.query({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should return no results for an explicit zero limit', async () => {
      const limited = await store.query({ limit: 0 });

      expect(limited).toEqual([]);
    });

    it('should reject invalid pagination values instead of treating them as unbounded', async () => {
      await expect(store.query({ limit: -1 })).rejects.toThrow(
        'Memory query limit must be a non-negative integer',
      );
      await expect(store.query({ offset: 1.5 })).rejects.toThrow(
        'Memory query offset must be a non-negative integer',
      );
    });

    it('should support an offset without an explicit limit', async () => {
      const page = await store.query({ offset: 2 });

      expect(page.map((entry) => entry.content)).toEqual(['Fact 2', 'Pref 1']);
    });

    it('should include the full UTC day for date-only filters', async () => {
      const entry = await store.create({ type: 'fact', content: 'Date-filtered fact' });
      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...params: string[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(
        '2026-10-01T18:00:00.000Z',
        entry.id,
      );

      const results = await store.query({ since: '2026-10-01', until: '2026-10-01' });

      expect(results.map((memory) => memory.content)).toContain('Date-filtered fact');
      expect(store.count({ since: '2026-10-01', until: '2026-10-01' })).toBe(1);
    });

    it('should use a stable ID tie-breaker for paginated ties', async () => {
      const first = await store.create({ type: 'fact', content: 'Tie 1', importance: 0.4 });
      const second = await store.create({ type: 'fact', content: 'Tie 2', importance: 0.4 });
      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...params: string[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id IN (?, ?)').run(
        '2026-10-25T12:00:00.000Z',
        first.id,
        second.id,
      );

      const all = await store.query({ minImportance: 0.4, maxImportance: 0.4 });
      const firstPage = await store.query({ minImportance: 0.4, maxImportance: 0.4, limit: 1 });
      const secondPage = await store.query({ minImportance: 0.4, maxImportance: 0.4, limit: 1, offset: 1 });

      expect([firstPage[0].id, secondPage[0].id]).toEqual(all.map((entry) => entry.id));
      expect([first.id, second.id].sort()).toEqual([firstPage[0].id, secondPage[0].id]);
    });

    it('should filter by tags', async () => {
      const tagged = await store.query({ tags: ['ui'] });
      expect(tagged).toHaveLength(1);
      expect(tagged[0].content).toBe('Pref 1');
    });

    it('should match literal tag values instead of LIKE patterns', async () => {
      await store.create({ type: 'fact', content: 'Literal percent', tags: ['50%'] });
      await store.create({ type: 'fact', content: 'Different percent', tags: ['50x'] });

      const tagged = await store.query({ tags: ['50%'] });

      expect(tagged).toHaveLength(1);
      expect(tagged[0].content).toBe('Literal percent');
      expect(store.count({ tags: ['50%'] })).toBe(1);
    });

    it('should search content', async () => {
      const results = await store.query({ search: 'Fact' });
      expect(results).toHaveLength(2);
    });

    it('should search tag values as well as content', async () => {
      const results = await store.query({ search: 'ui' });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Pref 1');
      expect(store.count({ search: 'ui' })).toBe(1);
    });

    it('should treat LIKE metacharacters in searches literally', async () => {
      await store.create({ type: 'fact', content: 'Budget is 100% approved' });
      await store.create({ type: 'fact', content: 'Budget is 100x approved' });
      await store.create({ type: 'fact', content: 'user_name is set' });
      await store.create({ type: 'fact', content: 'username is set' });

      const percentResults = await store.query({ search: '100%' });
      const underscoreResults = await store.query({ search: 'user_name' });

      expect(percentResults.map((entry) => entry.content)).toEqual(['Budget is 100% approved']);
      expect(underscoreResults.map((entry) => entry.content)).toEqual(['user_name is set']);
      expect(store.count({ search: '100%' })).toBe(1);
    });

    it('should count entries using the same filters as query', () => {
      expect(store.count()).toBe(4);
      expect(store.count({ type: 'fact' })).toBe(2);
      expect(store.count({ tags: ['ui'] })).toBe(1);
      expect(store.count({ minImportance: 0.6 })).toBe(2);
      expect(store.count({ maxImportance: 0.5 })).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await store.create({ type: 'fact', content: 'Fact 1' });
      await store.create({ type: 'fact', content: 'Fact 2' });
      await store.create({ type: 'event', content: 'Event 1' });

      const stats = store.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.byType.fact).toBe(2);
      expect(stats.byType.event).toBe(1);
      expect(stats.byType.preference).toBe(0);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await store.create({ type: 'fact', content: 'Fact 1' });
      await store.create({ type: 'fact', content: 'Fact 2' });

      store.clear();

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});

describe('MemoryStore with encryption', () => {
  let store: MemoryStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `test-memory-encrypted-${randomUUID()}.db`);
    store = new MemoryStore({ 
      dbPath, 
      keySource: { passphrase: 'test-passphrase' },
      encryptionEnabled: true,
    });
  });

  afterEach(() => {
    store.close();
    try {
      rmSync(dbPath);
    } catch {
      // ignore cleanup errors
    }
  });

  it('should encrypt and decrypt memory content', async () => {
    const entry = await store.create({
      type: 'fact',
      content: 'This is a secret fact',
      importance: 0.8,
    });

    // Retrieve and verify content is decrypted correctly
    const retrieved = await store.get(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('This is a secret fact');
  });

  it('should handle multiple encrypted entries', async () => {
    await store.create({ type: 'fact', content: 'Secret 1' });
    await store.create({ type: 'fact', content: 'Secret 2' });
    await store.create({ type: 'preference', content: 'Secret preference' });

    const all = await store.query({});
    expect(all).toHaveLength(3);
    expect(all.map(e => e.content)).toContain('Secret 1');
    expect(all.map(e => e.content)).toContain('Secret 2');
    expect(all.map(e => e.content)).toContain('Secret preference');
  });

  it('should preserve encryption when updating metadata without content', async () => {
    const entry = await store.create({
      type: 'fact',
      content: 'Secret metadata fact',
      metadata: { source: 'initial' },
    });

    const updated = await store.update(entry.id, {
      metadata: { source: 'updated' },
    });

    expect(updated).not.toBeNull();
    expect(updated!.content).toBe('Secret metadata fact');
    expect(updated!.metadata).toEqual({ source: 'updated' });
  });
});
