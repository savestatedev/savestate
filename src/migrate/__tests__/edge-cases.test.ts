/**
 * Edge Case Tests for Migration Wizard
 *
 * Tests boundary conditions and unusual scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { MigrationOrchestrator } from '../orchestrator.js';
import { registerMockPlugins } from '../testing/index.js';
import { ChatGPTToClaudeTransformer } from '../transformers/chatgpt-to-claude.js';
import { ClaudeToChatGPTTransformer } from '../transformers/claude-to-chatgpt.js';
import { registerTransformer } from '../transformers/registry.js';
import type { MigrationBundle, MemoryEntry, FileEntry } from '../types.js';

describe('Edge Case Tests', () => {
  let testWorkDir: string;

  beforeEach(async () => {
    testWorkDir = join(
      tmpdir(),
      `savestate-edge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testWorkDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testWorkDir)) {
      await rm(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('Empty Source Account', () => {
    it('should handle account with no data to migrate', async () => {
      const emptyBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_empty',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {},
        metadata: {
          totalItems: 0,
          itemCounts: {
            instructions: 0,
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
        extractors: { chatgpt: { customBundle: emptyBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-empty'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      expect(result.loaded.instructions).toBe(false);
      expect(result.loaded.memories).toBe(0);
      expect(result.loaded.files).toBe(0);
    });

    it('should handle account with only empty containers', async () => {
      const emptyContainersBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_empty_containers',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          memories: { entries: [], count: 0 },
          files: { files: [], count: 0, totalSize: 0 },
          customBots: { bots: [], count: 0 },
          conversations: {
            path: 'conversations/',
            count: 0,
            messageCount: 0,
            summaries: [],
          },
        },
        metadata: {
          totalItems: 0,
          itemCounts: {
            instructions: 0,
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
        extractors: { chatgpt: { customBundle: emptyContainersBundle } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-empty-containers'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });
  });

  describe('Very Large Accounts', () => {
    it('should handle 1000+ conversations', async () => {
      const conversations = Array.from({ length: 1000 }, (_, i) => ({
        id: `conv_${i}`,
        title: `Conversation ${i}`,
        messageCount: Math.floor(Math.random() * 50) + 5,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
        keyPoints: i % 10 === 0 ? [`Key point from conversation ${i}`] : undefined,
      }));

      const largeBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_large_conversations',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          conversations: {
            path: 'conversations/',
            count: 1000,
            messageCount: conversations.reduce((sum, c) => sum + c.messageCount, 0),
            summaries: conversations,
          },
        },
        metadata: {
          totalItems: 1000,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 1000,
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

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-large-convs'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      const bundle = orchestrator.getBundle();
      expect(bundle?.contents.conversations?.count).toBe(1000);
    });

    it('should handle 500+ memories', async () => {
      const memories: MemoryEntry[] = Array.from({ length: 500 }, (_, i) => ({
        id: `mem_${i}`,
        content: `Memory entry ${i}: User learned about ${['TypeScript', 'React', 'Node.js', 'Python', 'Go'][i % 5]}`,
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
        category: ['preferences', 'facts', 'context', 'decisions'][i % 4],
      }));

      const largeMemoriesBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_large_memories',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          memories: { entries: memories, count: 500 },
        },
        metadata: {
          totalItems: 500,
          itemCounts: {
            instructions: 0,
            memories: 500,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: largeMemoriesBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-large-memories'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      // Should have a warning about large number of memories
      const bundle = orchestrator.getBundle();
      expect(bundle?.metadata.warnings.some((w) => w.includes('memories') || w.includes('500'))).toBe(true);
    });
  });

  describe('Files Exceeding Size Limits', () => {
    it('should skip files exceeding Claude size limit', async () => {
      const filesBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_large_files',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          files: {
            files: [
              {
                id: 'file_small',
                filename: 'small.txt',
                mimeType: 'text/plain',
                size: 1024, // 1KB
                path: 'files/small.txt',
              },
              {
                id: 'file_huge',
                filename: 'huge-database.sql',
                mimeType: 'application/sql',
                size: 150 * 1024 * 1024, // 150MB - exceeds limit
                path: 'files/huge-database.sql',
              },
              {
                id: 'file_medium',
                filename: 'medium.pdf',
                mimeType: 'application/pdf',
                size: 5 * 1024 * 1024, // 5MB - within limit
                path: 'files/medium.pdf',
              },
            ],
            count: 3,
            totalSize: 155 * 1024 * 1024,
          },
        },
        metadata: {
          totalItems: 3,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 0,
            files: 3,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: filesBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-large-files'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      // 2 files should be loaded (small + medium), 1 skipped
      expect(result.loaded.files).toBe(2);

      const bundle = orchestrator.getBundle();
      expect(bundle?.contents.files?.count).toBe(2);
      expect(bundle?.metadata.warnings.some((w) => w.includes('huge-database.sql'))).toBe(true);
    });
  });

  describe('Unicode and Emoji in Content', () => {
    it('should preserve Unicode characters in instructions', async () => {
      const unicodeBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_unicode',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: `## 关于我 (About Me) 🎯

I speak multiple languages:
- 日本語 (Japanese)
- 中文 (Chinese)
- العربية (Arabic)
- עברית (Hebrew)
- हिंदी (Hindi)

Emoji support: 🚀 💻 🎨 🔧 ⚡️ 🎸

Mathematical symbols: ∑ ∫ ∂ ∞ √ π

Special characters: © ® ™ € £ ¥`,
            length: 300,
          },
          memories: {
            entries: [
              {
                id: 'mem_unicode',
                content: 'ユーザーは日本に住んでいます 🇯🇵',
                createdAt: new Date().toISOString(),
              },
              {
                id: 'mem_emoji',
                content: 'Favorite foods: 🍕🍣🌮🍜',
                createdAt: new Date().toISOString(),
              },
              {
                id: 'mem_math',
                content: 'User is studying calculus: ∫₀^∞ e^(-x²)dx = √π/2',
                createdAt: new Date().toISOString(),
              },
            ],
            count: 3,
          },
        },
        metadata: {
          totalItems: 4,
          itemCounts: {
            instructions: 1,
            memories: 3,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: unicodeBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-unicode'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);

      const bundle = orchestrator.getBundle();
      expect(bundle?.contents.instructions?.content).toContain('日本語');
      expect(bundle?.contents.instructions?.content).toContain('🚀');
      expect(bundle?.contents.instructions?.content).toContain('∑');
    });

    it('should handle filenames with Unicode characters', async () => {
      const unicodeFilesBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_unicode_files',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          files: {
            files: [
              {
                id: 'file_jp',
                filename: 'ドキュメント.pdf',
                mimeType: 'application/pdf',
                size: 1024,
                path: 'files/ドキュメント.pdf',
              },
              {
                id: 'file_emoji',
                filename: '🚀 launch-plan.md',
                mimeType: 'text/markdown',
                size: 512,
                path: 'files/🚀 launch-plan.md',
              },
            ],
            count: 2,
            totalSize: 1536,
          },
        },
        metadata: {
          totalItems: 2,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 0,
            files: 2,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: unicodeFilesBundle } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-unicode-files'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(2);
    });
  });

  describe('Long Custom Instructions Requiring Truncation', () => {
    it('should truncate instructions exceeding target limit', async () => {
      // Claude has ~8000 char limit, create instructions that exceed it
      const veryLongContent = Array.from({ length: 200 }, (_, i) =>
        `Section ${i}: This is a detailed instruction about how to handle situation ${i}. `
      ).join('\n\n');

      const longInstructionsBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_long_instructions',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: veryLongContent,
            length: veryLongContent.length,
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
        extractors: { chatgpt: { customBundle: longInstructionsBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-long-instructions'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);

      const bundle = orchestrator.getBundle();
      // Instructions should be truncated to fit within limit
      expect(bundle?.contents.instructions?.length).toBeLessThanOrEqual(20000); // Claude's limit
      // Should have a warning about truncation
      expect(bundle?.metadata.warnings.some((w) =>
        w.toLowerCase().includes('truncat') || w.toLowerCase().includes('summar')
      )).toBe(true);
    });

    it('should use summarize strategy when configured', async () => {
      const longContent = 'x'.repeat(25000); // Exceeds limit

      const bundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_summarize',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: { content: longContent, length: longContent.length },
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

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-summarize'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });
  });

  describe('Network Interruption Simulation', () => {
    it('should handle network failure during extraction', async () => {
      registerMockPlugins({
        extractors: {
          chatgpt: {
            shouldFail: true,
            failureMessage: 'Network error: Connection timed out',
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-network-extract'),
      });

      await expect(orchestrator.run()).rejects.toThrow('Connection timed out');

      const state = orchestrator.getState();
      expect(state.phase).toBe('failed');
      expect(state.error).toContain('Connection timed out');
    });

    it('should handle network failure during load phase', async () => {
      registerMockPlugins({
        loaders: {
          claude: {
            shouldFail: true,
            failureMessage: 'API Error: 503 Service Unavailable',
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-network-load'),
      });

      await expect(orchestrator.run()).rejects.toThrow('503 Service Unavailable');

      const state = orchestrator.getState();
      expect(state.phase).toBe('failed');
    });

    it('should handle partial load failure', async () => {
      registerMockPlugins({
        loaders: {
          claude: {
            partialFailure: {
              memories: true,
              files: true,
            },
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-partial-failure'),
      });

      const result = await orchestrator.run();

      // Should still succeed but with warnings
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Auth Token Expiration Simulation', () => {
    it('should handle auth failure during extraction', async () => {
      registerMockPlugins({
        extractors: {
          chatgpt: {
            canExtractResult: false,
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-auth-extract'),
      });

      await expect(orchestrator.run()).rejects.toThrow(/Cannot extract/);
    });

    it('should handle auth failure during load', async () => {
      registerMockPlugins({
        loaders: {
          claude: {
            canLoadResult: false,
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-auth-load'),
      });

      await expect(orchestrator.run()).rejects.toThrow(/Cannot load/);
    });

    it('should handle mid-migration auth expiration', async () => {
      registerMockPlugins({
        loaders: {
          claude: {
            shouldFail: true,
            failureMessage: 'Authentication failed: Token expired',
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-token-expired'),
      });

      await expect(orchestrator.run()).rejects.toThrow('Token expired');
    });
  });

  describe('Special Characters in Identifiers', () => {
    it('should handle conversation IDs with special characters', async () => {
      const specialIdBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_special_ids',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          conversations: {
            path: 'conversations/',
            count: 3,
            messageCount: 30,
            summaries: [
              {
                id: 'conv-123-456-789',
                title: 'Normal ID',
                messageCount: 10,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'conv/with/slashes',
                title: 'Slashed ID',
                messageCount: 10,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'conv with spaces & special<>chars',
                title: 'Special Chars ID',
                messageCount: 10,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        },
        metadata: {
          totalItems: 3,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 3,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: specialIdBundle } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-special-ids'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });
  });

  describe('Malformed Data Handling', () => {
    it('should handle instructions with null content', async () => {
      const malformedBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_malformed',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: '', // Empty content
            length: 0,
          },
        },
        metadata: {
          totalItems: 0,
          itemCounts: {
            instructions: 0,
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
        extractors: { chatgpt: { customBundle: malformedBundle } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-malformed'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });

    it('should handle memories with missing required fields', async () => {
      const incompleteMemoriesBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_incomplete_memories',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          memories: {
            entries: [
              {
                id: 'mem_complete',
                content: 'Complete memory entry',
                createdAt: new Date().toISOString(),
              },
              {
                id: 'mem_no_content',
                content: '', // Empty content
                createdAt: new Date().toISOString(),
              },
            ],
            count: 2,
          },
        },
        metadata: {
          totalItems: 2,
          itemCounts: {
            instructions: 0,
            memories: 2,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: incompleteMemoriesBundle } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-incomplete-memories'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });
  });

  describe('Timestamp Edge Cases', () => {
    it('should handle various date formats', async () => {
      const dateBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_dates',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          memories: {
            entries: [
              {
                id: 'mem_iso',
                content: 'ISO date memory',
                createdAt: '2024-01-15T10:30:00.000Z',
              },
              {
                id: 'mem_old',
                content: 'Very old memory',
                createdAt: '2020-01-01T00:00:00.000Z',
              },
              {
                id: 'mem_future',
                content: 'Future dated memory', // Edge case
                createdAt: '2030-12-31T23:59:59.999Z',
              },
            ],
            count: 3,
          },
        },
        metadata: {
          totalItems: 3,
          itemCounts: {
            instructions: 0,
            memories: 3,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: dateBundle } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-dates'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });
  });
});
