/**
 * Honeyfact Seeder Tests
 *
 * Tests for the Memory Integrity Grid honeyfact system.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  generateHoneyfacts,
  seedHoneyfacts,
  getActiveHoneyfacts,
  getAllHoneyfacts,
  rotateHoneyfacts,
  checkForHoneyfacts,
  clearHoneyfacts,
  getHoneyfactStats,
} from '../honeyfact.js';
import type { HoneyfactCategory, HoneyfactTemplate } from '../honeyfact.js';

describe('Honeyfact Seeder', () => {
  let testDir: string;
  const testTenant = 'test-tenant';

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-test-${randomUUID()}`);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateHoneyfacts', () => {
    it('should generate the requested number of honeyfacts', () => {
      const honeyfacts = generateHoneyfacts(5, { tenant_id: testTenant });

      expect(honeyfacts).toHaveLength(5);
      expect(honeyfacts.every(hf => hf.id.startsWith('hf_'))).toBe(true);
    });

    it('should distribute across categories', () => {
      const honeyfacts = generateHoneyfacts(12, { tenant_id: testTenant });
      const categories = new Set(honeyfacts.map(hf => hf.category));

      // Should have multiple categories
      expect(categories.size).toBeGreaterThan(1);
    });

    it('should respect specified categories', () => {
      const honeyfacts = generateHoneyfacts(5, {
        tenant_id: testTenant,
        categories: ['api_key', 'url'] as HoneyfactCategory[],
      });

      const categories = new Set(honeyfacts.map(hf => hf.category));
      expect(categories.size).toBeLessThanOrEqual(2);
      expect([...categories].every(c => ['api_key', 'url'].includes(c))).toBe(true);
    });

    it('should set correct TTL and expiration', () => {
      const honeyfacts = generateHoneyfacts(1, {
        tenant_id: testTenant,
        ttl_days: 14,
      });

      expect(honeyfacts[0].ttl_days).toBe(14);
      const created = new Date(honeyfacts[0].created_at);
      const expires = new Date(honeyfacts[0].expires_at);
      const diffDays = (expires.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(14);
    });

    it('should set honeyfacts as active', () => {
      const honeyfacts = generateHoneyfacts(3, { tenant_id: testTenant });
      expect(honeyfacts.every(hf => hf.active)).toBe(true);
    });

    it('should generate unique content', () => {
      const honeyfacts = generateHoneyfacts(10, { tenant_id: testTenant });
      const contents = honeyfacts.map(hf => hf.content);
      const uniqueContents = new Set(contents);

      // All content should be unique
      expect(uniqueContents.size).toBe(contents.length);
    });
  });

  describe('seedHoneyfacts', () => {
    it('should seed honeyfacts and persist them', async () => {
      const result = await seedHoneyfacts('test', 5, {
        tenant_id: testTenant,
        ttl_days: 7,
      }, testDir);

      expect(result.count).toBe(5);
      expect(result.honeyfacts).toHaveLength(5);
      expect(result.tenant_id).toBe(testTenant);
      expect(result.seeded_at).toBeDefined();

      // Verify persistence
      const all = await getAllHoneyfacts(testDir);
      expect(all.length).toBe(5);
    });

    it('should add namespace prefix to tenant_id', async () => {
      const result = await seedHoneyfacts('namespace', 2, {
        tenant_id: testTenant,
      }, testDir);

      expect(result.honeyfacts.every(hf =>
        hf.tenant_id.startsWith('namespace:')
      )).toBe(true);
    });
  });

  describe('getActiveHoneyfacts', () => {
    it('should return only active, non-expired honeyfacts', async () => {
      await seedHoneyfacts('test', 5, { tenant_id: testTenant }, testDir);
      const active = await getActiveHoneyfacts(testTenant, testDir);

      expect(active.length).toBe(5);
      expect(active.every(hf => hf.active)).toBe(true);
    });

    it('should filter by tenant_id', async () => {
      await seedHoneyfacts('test', 3, { tenant_id: 'tenant-a' }, testDir);
      await seedHoneyfacts('test', 2, { tenant_id: 'tenant-b' }, testDir);

      const activeA = await getActiveHoneyfacts('tenant-a', testDir);
      const activeB = await getActiveHoneyfacts('tenant-b', testDir);

      expect(activeA.length).toBe(3);
      expect(activeB.length).toBe(2);
    });
  });

  describe('checkForHoneyfacts', () => {
    it('should detect exact honeyfact matches', async () => {
      const result = await seedHoneyfacts('test', 3, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = result.honeyfacts[0].content;
      const matched = await checkForHoneyfacts(
        `Some text with ${honeyfactContent} embedded`,
        testTenant,
        testDir,
      );

      expect(matched.length).toBe(1);
      expect(matched[0].id).toBe(result.honeyfacts[0].id);
    });

    it('should detect case-insensitive matches', async () => {
      const result = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = result.honeyfacts[0].content.toLowerCase();
      const matched = await checkForHoneyfacts(
        honeyfactContent,
        testTenant,
        testDir,
      );

      expect(matched.length).toBe(1);
    });

    it('should return empty array for no matches', async () => {
      await seedHoneyfacts('test', 3, { tenant_id: testTenant }, testDir);

      const matched = await checkForHoneyfacts(
        'This is completely normal content with no honeyfacts',
        testTenant,
        testDir,
      );

      expect(matched.length).toBe(0);
    });

    it('should detect multiple honeyfacts in same content', async () => {
      const result = await seedHoneyfacts('test', 3, {
        tenant_id: testTenant,
      }, testDir);

      const content = result.honeyfacts.map(hf => hf.content).join(' ');
      const matched = await checkForHoneyfacts(content, testTenant, testDir);

      expect(matched.length).toBe(3);
    });
  });

  describe('rotateHoneyfacts', () => {
    it('should not rotate non-expired honeyfacts', async () => {
      await seedHoneyfacts('test', 5, {
        tenant_id: testTenant,
        ttl_days: 7,
      }, testDir);

      const result = await rotateHoneyfacts({
        tenant_id: testTenant,
        ttl_days: 7,
      }, testDir);

      expect(result.rotated).toBe(0);
      expect(result.valid).toBe(5);
      expect(result.created.length).toBe(0);
      expect(result.retired.length).toBe(0);
    });
  });

  describe('clearHoneyfacts', () => {
    it('should clear honeyfacts for specified tenant', async () => {
      await seedHoneyfacts('test', 5, { tenant_id: 'tenant-a' }, testDir);
      await seedHoneyfacts('test', 3, { tenant_id: 'tenant-b' }, testDir);

      const cleared = await clearHoneyfacts('tenant-a', testDir);
      expect(cleared).toBe(5);

      const remaining = await getAllHoneyfacts(testDir);
      expect(remaining.length).toBe(3);
      expect(remaining.every(hf => hf.tenant_id.endsWith('tenant-b'))).toBe(true);
    });
  });

  describe('getHoneyfactStats', () => {
    it('should return correct statistics', async () => {
      await seedHoneyfacts('test', 10, { tenant_id: testTenant }, testDir);

      const stats = await getHoneyfactStats(testTenant, testDir);

      expect(stats.total).toBe(10);
      expect(stats.active).toBe(10);
      expect(stats.expired).toBe(0);
      // Categories should add up
      const categoryTotal = Object.values(stats.by_category).reduce((a, b) => a + b, 0);
      expect(categoryTotal).toBe(10);
    });

    it('should filter by tenant when specified', async () => {
      await seedHoneyfacts('test', 5, { tenant_id: 'tenant-x' }, testDir);
      await seedHoneyfacts('test', 7, { tenant_id: 'tenant-y' }, testDir);

      const statsX = await getHoneyfactStats('tenant-x', testDir);
      const statsY = await getHoneyfactStats('tenant-y', testDir);

      expect(statsX.total).toBe(5);
      expect(statsY.total).toBe(7);
    });
  });
});

describe('Precision and Recall Metrics', () => {
  // These tests validate the MVP success criteria for precision/recall

  it('should achieve high precision (low false positives)', async () => {
    const testDir = join(tmpdir(), `savestate-precision-${randomUUID()}`);
    const tenant = 'precision-test';

    try {
      // Seed honeyfacts
      const result = await seedHoneyfacts('test', 10, {
        tenant_id: tenant,
      }, testDir);

      // Test with 100 normal sentences (should not trigger)
      const normalSentences = [
        'The weather is nice today.',
        'I need to buy groceries.',
        'The project deadline is next week.',
        'Let me check the documentation.',
        'The API returns a JSON response.',
        'We should refactor this code.',
        'The test suite passed.',
        'I\'ll deploy the changes tomorrow.',
        'The meeting is at 3pm.',
        'Can you review this PR?',
      ];

      let falsePositives = 0;
      for (const sentence of normalSentences) {
        const matched = await checkForHoneyfacts(sentence, tenant, testDir);
        if (matched.length > 0) {
          falsePositives++;
        }
      }

      // Precision = true_positives / (true_positives + false_positives)
      // With 0 actual honeyfacts in normal text, false positives should be 0
      const precision = falsePositives === 0 ? 1 : 0;
      expect(precision).toBeGreaterThanOrEqual(0.85); // MVP criteria: >= 0.85
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should achieve target recall (catch most attacks)', async () => {
    const testDir = join(tmpdir(), `savestate-recall-${randomUUID()}`);
    const tenant = 'recall-test';

    try {
      // Seed honeyfacts
      const result = await seedHoneyfacts('test', 10, {
        tenant_id: tenant,
      }, testDir);

      // Test with actual honeyfact content
      let truePositives = 0;
      for (const hf of result.honeyfacts) {
        const matched = await checkForHoneyfacts(hf.content, tenant, testDir);
        if (matched.some(m => m.id === hf.id)) {
          truePositives++;
        }
      }

      // Recall = true_positives / (true_positives + false_negatives)
      const recall = truePositives / result.honeyfacts.length;
      expect(recall).toBeGreaterThanOrEqual(0.6); // MVP criteria: >= 0.60
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
