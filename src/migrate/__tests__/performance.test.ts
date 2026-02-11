/**
 * Performance Tests for Migration Wizard
 *
 * Tests memory usage, progress responsiveness, and large dataset handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { MigrationOrchestrator, type MigrationEvent } from '../orchestrator.js';
import { registerMockPlugins } from '../testing/index.js';
import { ChatGPTToClaudeTransformer } from '../transformers/chatgpt-to-claude.js';
import { registerTransformer } from '../transformers/registry.js';
import type { MigrationBundle, MemoryEntry, ConversationSummary, FileEntry } from '../types.js';

describe('Performance Tests', () => {
  let testWorkDir: string;

  beforeEach(async () => {
    testWorkDir = join(
      tmpdir(),
      `savestate-perf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testWorkDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testWorkDir)) {
      await rm(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('Memory Usage Bounds', () => {
    it('should handle large conversation dataset without memory explosion', async () => {
      // Create a bundle with 2000 conversations
      const conversations: ConversationSummary[] = Array.from({ length: 2000 }, (_, i) => ({
        id: `conv_${i}`,
        title: `Conversation ${i}: ${generateRandomTitle()}`,
        messageCount: Math.floor(Math.random() * 100) + 10,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
        keyPoints: i % 5 === 0
          ? [`Key point ${i}-1`, `Key point ${i}-2`, `Key point ${i}-3`]
          : undefined,
      }));

      const largeBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_large_memory_test',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          conversations: {
            path: 'conversations/',
            count: 2000,
            messageCount: conversations.reduce((sum, c) => sum + c.messageCount, 0),
            summaries: conversations,
          },
        },
        metadata: {
          totalItems: 2000,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 2000,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: largeBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-large-memory'),
      });

      const result = await orchestrator.run();

      // Get final memory usage
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(result.success).toBe(true);

      // Memory increase should be reasonable (< 200MB for 2000 conversations)
      // This is a rough bound - actual implementation should be much lower
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    });

    it('should handle large memory dataset efficiently', async () => {
      // Create 1000 memory entries with varying content sizes
      const memories: MemoryEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `mem_${i}`,
        content: generateVariableContent(100 + (i % 500)),
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
        category: ['preferences', 'facts', 'context', 'decisions', 'insights'][i % 5],
        source: 'chatgpt',
      }));

      const bundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_large_memories',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          memories: { entries: memories, count: 1000 },
        },
        metadata: {
          totalItems: 1000,
          itemCounts: {
            instructions: 0,
            memories: 1000,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: bundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const initialMemory = process.memoryUsage().heapUsed;

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-large-memories'),
      });

      const result = await orchestrator.run();
      const finalMemory = process.memoryUsage().heapUsed;

      expect(result.success).toBe(true);

      // Memory increase should be bounded
      const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024);
      expect(memoryIncreaseMB).toBeLessThan(100);
    });
  });

  describe('Progress Update Responsiveness', () => {
    it('should emit progress updates at regular intervals', async () => {
      // Use mocks with delays to simulate real processing
      registerMockPlugins({
        extractors: { chatgpt: { delayMs: 500 } },
        transformers: { 'chatgpt->claude': { delayMs: 500 } },
        loaders: { claude: { delayMs: 500 } },
      });

      const progressEvents: MigrationEvent[] = [];
      const progressTimestamps: number[] = [];

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-progress-timing'),
      });

      orchestrator.on((event) => {
        if (event.type === 'progress') {
          progressEvents.push(event);
          progressTimestamps.push(Date.now());
        }
      });

      const startTime = Date.now();
      await orchestrator.run();
      const endTime = Date.now();

      // Should have multiple progress events
      expect(progressEvents.length).toBeGreaterThan(10);

      // Check intervals between progress updates
      if (progressTimestamps.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < progressTimestamps.length; i++) {
          intervals.push(progressTimestamps[i] - progressTimestamps[i - 1]);
        }

        // Average interval should be reasonable (< 500ms for responsive UI)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        expect(avgInterval).toBeLessThan(500);
      }
    });

    it('should provide progress updates throughout all phases', async () => {
      registerMockPlugins({
        extractors: { chatgpt: { delayMs: 300 } },
        transformers: { 'chatgpt->claude': { delayMs: 300 } },
        loaders: { claude: { delayMs: 300 } },
      });

      const phaseProgress: Map<string, number[]> = new Map();

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-phase-progress'),
      });

      let currentPhase = 'pending';

      orchestrator.on((event) => {
        if (event.type === 'phase:start' && event.phase) {
          currentPhase = event.phase;
          phaseProgress.set(currentPhase, []);
        }
        if (event.type === 'progress' && event.progress !== undefined) {
          const progress = phaseProgress.get(currentPhase) || [];
          progress.push(event.progress);
          phaseProgress.set(currentPhase, progress);
        }
      });

      await orchestrator.run();

      // Each phase should have progress updates
      expect(phaseProgress.has('extracting')).toBe(true);
      expect(phaseProgress.has('transforming')).toBe(true);
      expect(phaseProgress.has('loading')).toBe(true);

      // Progress should increase within each phase
      for (const [phase, progressValues] of phaseProgress) {
        if (progressValues.length > 1) {
          for (let i = 1; i < progressValues.length; i++) {
            expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
          }
        }
      }
    });

    it('should not block on progress callbacks', async () => {
      registerMockPlugins({
        extractors: { chatgpt: { delayMs: 100 } },
        transformers: { 'chatgpt->claude': { delayMs: 100 } },
        loaders: { claude: { delayMs: 100 } },
      });

      let slowCallbackCount = 0;

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-slow-callback'),
      });

      orchestrator.on(async (event) => {
        if (event.type === 'progress') {
          // Simulate slow callback (shouldn't block migration)
          await new Promise((r) => setTimeout(r, 50));
          slowCallbackCount++;
        }
      });

      const startTime = Date.now();
      const result = await orchestrator.run();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(slowCallbackCount).toBeGreaterThan(0);

      // Total duration should not be significantly increased by slow callbacks
      // If callbacks blocked, duration would be >> 300ms + (50ms * slowCallbackCount)
      // With non-blocking, it should be closer to 300ms + small overhead
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Large File Handling', () => {
    it('should handle many small files efficiently', async () => {
      // Create 100 small files
      const files: FileEntry[] = Array.from({ length: 100 }, (_, i) => ({
        id: `file_${i}`,
        filename: `document_${i}.${['txt', 'md', 'json', 'yaml'][i % 4]}`,
        mimeType: ['text/plain', 'text/markdown', 'application/json', 'text/yaml'][i % 4],
        size: Math.floor(Math.random() * 50000) + 1000,
        path: `files/document_${i}.txt`,
      }));

      const bundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_many_files',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          files: {
            files,
            count: 100,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
          },
        },
        metadata: {
          totalItems: 100,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 0,
            files: 100,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: bundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const startTime = Date.now();

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-many-files'),
      });

      const result = await orchestrator.run();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(100);

      // Should complete in reasonable time (< 5 seconds for mock processing)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Concurrent Migrations', () => {
    it('should support multiple concurrent migrations', async () => {
      registerMockPlugins({
        extractors: { chatgpt: { delayMs: 100 } },
        transformers: { 'chatgpt->claude': { delayMs: 100 } },
        loaders: { claude: { delayMs: 100 } },
      });

      // Start multiple migrations concurrently
      const migrations = await Promise.all([
        (async () => {
          const o = new MigrationOrchestrator('chatgpt', 'claude', {
            workDir: join(testWorkDir, 'migration-concurrent-1'),
          });
          return o.run();
        })(),
        (async () => {
          const o = new MigrationOrchestrator('chatgpt', 'claude', {
            workDir: join(testWorkDir, 'migration-concurrent-2'),
          });
          return o.run();
        })(),
        (async () => {
          const o = new MigrationOrchestrator('chatgpt', 'claude', {
            workDir: join(testWorkDir, 'migration-concurrent-3'),
          });
          return o.run();
        })(),
      ]);

      // All should succeed
      expect(migrations.every((r) => r.success)).toBe(true);
    });

    it('should maintain isolation between concurrent migrations', async () => {
      const customBundle1: MigrationBundle = {
        version: '1.0',
        id: 'bundle_1',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          accountId: 'user_1',
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: { content: 'Instructions for user 1', length: 25 },
        },
        metadata: {
          totalItems: 1,
          itemCounts: {
            instructions: 1,
            memories: 0,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      const customBundle2: MigrationBundle = {
        version: '1.0',
        id: 'bundle_2',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          accountId: 'user_2',
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: { content: 'Instructions for user 2', length: 25 },
        },
        metadata: {
          totalItems: 1,
          itemCounts: {
            instructions: 1,
            memories: 0,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      // Start migrations with different bundles
      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-isolated-1'),
      });
      registerMockPlugins({
        extractors: { chatgpt: { customBundle: customBundle1 } },
      });
      const result1 = await orchestrator1.run();

      const orchestrator2 = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-isolated-2'),
      });
      registerMockPlugins({
        extractors: { chatgpt: { customBundle: customBundle2 } },
      });
      const result2 = await orchestrator2.run();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Bundles should remain distinct
      const bundle1 = orchestrator1.getBundle();
      const bundle2 = orchestrator2.getBundle();

      expect(bundle1?.id).not.toBe(bundle2?.id);
    });
  });

  describe('Transformation Performance', () => {
    it('should transform instructions efficiently even when long', async () => {
      // Create very long instructions (100KB)
      const longInstructions = Array.from({ length: 1000 }, (_, i) =>
        `Instruction block ${i}: This is a detailed instruction about topic ${i}. `.repeat(3),
      ).join('\n\n');

      const bundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_long_transform',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: longInstructions,
            length: longInstructions.length,
          },
        },
        metadata: {
          totalItems: 1,
          itemCounts: {
            instructions: 1,
            memories: 0,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: bundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const startTime = Date.now();

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-transform-perf'),
      });

      const result = await orchestrator.run();
      const transformTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Transformation of 100KB should complete quickly (< 2 seconds)
      expect(transformTime).toBeLessThan(2000);
    });
  });
});

// ─── Helper Functions ──────────────────────────────────────────

function generateRandomTitle(): string {
  const topics = [
    'Code Review',
    'Bug Fix',
    'Feature Discussion',
    'Architecture',
    'Testing Strategy',
    'Performance Optimization',
    'Security Review',
    'API Design',
    'Database Schema',
    'Deployment Planning',
  ];
  const actions = [
    'Discussion',
    'Analysis',
    'Planning',
    'Review',
    'Implementation',
    'Debugging',
    'Refactoring',
  ];
  return `${topics[Math.floor(Math.random() * topics.length)]} ${actions[Math.floor(Math.random() * actions.length)]}`;
}

function generateVariableContent(length: number): string {
  const words = [
    'user', 'prefers', 'typescript', 'react', 'node', 'python', 'docker',
    'kubernetes', 'aws', 'gcp', 'azure', 'mongodb', 'postgresql', 'redis',
    'graphql', 'rest', 'api', 'frontend', 'backend', 'fullstack', 'devops',
    'ci', 'cd', 'testing', 'unit', 'integration', 'e2e', 'performance',
  ];

  let content = '';
  while (content.length < length) {
    content += words[Math.floor(Math.random() * words.length)] + ' ';
  }
  return content.substring(0, length);
}
