/**
 * Tests for ChatGPT → Claude Transformer
 */

import { describe, it, expect, vi } from 'vitest';
import { ChatGPTToClaudeTransformer } from '../chatgpt-to-claude.js';
import type { MigrationBundle, TransformOptions } from '../../types.js';

// ─── Test Fixtures ───────────────────────────────────────────

function createChatGPTBundle(
  overrides: Partial<MigrationBundle['contents']> = {},
): MigrationBundle {
  return {
    version: '1.0',
    id: 'test-chatgpt-bundle',
    source: {
      platform: 'chatgpt',
      extractedAt: '2024-01-15T10:00:00Z',
      extractorVersion: '1.0.0',
    },
    contents: {
      instructions: {
        content: '## About Me\nI am a developer.\n\n## How ChatGPT Should Respond\nBe concise.',
        length: 70,
      },
      memories: {
        entries: [
          { id: 'm1', content: 'User prefers TypeScript', createdAt: '2024-01-01' },
          { id: 'm2', content: 'User works on web apps', createdAt: '2024-01-02' },
        ],
        count: 2,
      },
      conversations: {
        path: 'conversations/',
        count: 5,
        messageCount: 100,
        summaries: [
          {
            id: 'c1',
            title: 'Project Planning',
            messageCount: 20,
            createdAt: '2024-01-10',
            updatedAt: '2024-01-10',
            keyPoints: ['Decided on React', 'Will use TypeScript'],
          },
        ],
      },
      files: {
        files: [
          {
            id: 'f1',
            filename: 'readme.md',
            mimeType: 'text/markdown',
            size: 1024,
            path: 'files/readme.md',
          },
        ],
        count: 1,
        totalSize: 1024,
      },
      customBots: {
        bots: [
          {
            id: 'gpt1',
            name: 'Code Helper',
            description: 'Helps with code',
            instructions: 'You assist with coding tasks.',
            capabilities: ['code_interpreter'],
            createdAt: '2024-01-01',
          },
        ],
        count: 1,
      },
      ...overrides,
    },
    metadata: {
      totalItems: 10,
      itemCounts: {
        instructions: 1,
        memories: 2,
        conversations: 5,
        files: 1,
        customBots: 1,
      },
      warnings: [],
      errors: [],
    },
  };
}

const defaultTransformOptions: TransformOptions = {
  overflowStrategy: 'truncate',
  onProgress: vi.fn(),
};

// ─── Transformer Properties ──────────────────────────────────

describe('ChatGPTToClaudeTransformer', () => {
  describe('properties', () => {
    it('has correct source and target platforms', () => {
      const transformer = new ChatGPTToClaudeTransformer();

      expect(transformer.source).toBe('chatgpt');
      expect(transformer.target).toBe('claude');
      expect(transformer.version).toBe('1.0.0');
    });
  });

  // ─── Analysis ────────────────────────────────────────────

  describe('analyze', () => {
    it('returns compatibility report for valid bundle', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();

      const report = await transformer.analyze(bundle);

      expect(report.source).toBe('chatgpt');
      expect(report.target).toBe('claude');
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.generatedAt).toBeDefined();
    });

    it('marks short instructions as perfect', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: { content: 'Short instructions', length: 20 },
      });

      const report = await transformer.analyze(bundle);
      const instructionItem = report.items.find((i) => i.type === 'instructions');

      expect(instructionItem?.status).toBe('perfect');
    });

    it('marks long instructions as adapted', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: { content: 'A'.repeat(10000), length: 10000 },
      });

      const report = await transformer.analyze(bundle);
      const instructionItem = report.items.find((i) => i.type === 'instructions');

      expect(instructionItem?.status).toBe('adapted');
    });

    it('marks memories as adapted (Claude uses docs)', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();

      const report = await transformer.analyze(bundle);
      const memoryItem = report.items.find((i) => i.type === 'memory');

      expect(memoryItem?.status).toBe('adapted');
      expect(memoryItem?.action).toContain('document');
    });

    it('marks oversized files as incompatible', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        files: {
          files: [
            {
              id: 'big',
              filename: 'huge.zip',
              mimeType: 'application/zip',
              size: 100 * 1024 * 1024, // 100MB, over Claude's 32MB limit
              path: 'files/huge.zip',
            },
          ],
          count: 1,
          totalSize: 100 * 1024 * 1024,
        },
      });

      const report = await transformer.analyze(bundle);
      const fileItem = report.items.find(
        (i) => i.type === 'file' && i.status === 'incompatible',
      );

      expect(fileItem).toBeDefined();
      expect(fileItem?.reason).toContain('exceeds');
    });

    it('provides helpful recommendations', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: { content: 'Short', length: 5 },
      });

      const report = await transformer.analyze(bundle);

      expect(report.recommendations.some((r) => r.includes('longer system prompts'))).toBe(true);
    });

    it('calculates feasibility based on compatibility', async () => {
      const transformer = new ChatGPTToClaudeTransformer();

      // Easy case - all perfect
      const easyBundle = createChatGPTBundle({
        instructions: { content: 'Short', length: 5 },
        memories: undefined,
        customBots: undefined,
      });
      const easyReport = await transformer.analyze(easyBundle);
      expect(['easy', 'moderate']).toContain(easyReport.feasibility);

      // Complex case - lots of adaptations
      const complexBundle = createChatGPTBundle({
        instructions: { content: 'A'.repeat(10000), length: 10000 },
        files: {
          files: [
            { id: '1', filename: 'huge.zip', mimeType: 'application/zip', size: 100 * 1024 * 1024, path: '' },
          ],
          count: 1,
          totalSize: 100 * 1024 * 1024,
        },
      });
      const complexReport = await transformer.analyze(complexBundle);
      expect(['moderate', 'complex', 'partial']).toContain(complexReport.feasibility);
    });
  });

  // ─── Transformation ──────────────────────────────────────

  describe('transform', () => {
    it('transforms valid ChatGPT bundle to Claude format', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.target?.platform).toBe('claude');
      expect(result.target?.transformerVersion).toBe('1.0.0');
      expect(result.target?.transformedAt).toBeDefined();
    });

    it('rejects non-ChatGPT bundles', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();
      bundle.source.platform = 'claude';

      await expect(transformer.transform(bundle, defaultTransformOptions)).rejects.toThrow(
        'Expected ChatGPT bundle',
      );
    });

    it('converts ChatGPT instructions to Claude system prompt format', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: {
          content: '## About Me\nI am a developer.\n\n## How ChatGPT Should Respond\nBe helpful.',
          length: 65,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.instructions?.content).toContain('User Context');
      expect(result.contents.instructions?.content).toContain('Response Guidelines');
    });

    it('truncates oversized instructions with truncate strategy', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: { content: 'A'.repeat(10000), length: 10000 },
      });

      const result = await transformer.transform(bundle, {
        ...defaultTransformOptions,
        overflowStrategy: 'truncate',
      });

      expect(result.contents.instructions!.length).toBeLessThanOrEqual(8000);
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
    });

    it('throws with error strategy on overflow', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: { content: 'A'.repeat(10000), length: 10000 },
      });

      await expect(
        transformer.transform(bundle, {
          ...defaultTransformOptions,
          overflowStrategy: 'error',
        }),
      ).rejects.toThrow('exceed limit');
    });

    it('preserves memories with category tagging', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.memories).toBeDefined();
      expect(result.contents.memories!.count).toBe(2);
    });

    it('warns about large memory counts', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        memories: {
          entries: Array.from({ length: 60 }, (_, i) => ({
            id: `m${i}`,
            content: `Memory ${i}`,
            createdAt: '2024-01-01',
          })),
          count: 60,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.metadata.warnings.some((w) => w.includes('Large number of memories'))).toBe(
        true,
      );
    });

    it('filters out oversized files', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        files: {
          files: [
            { id: '1', filename: 'small.txt', mimeType: 'text/plain', size: 1024, path: 'files/small.txt' },
            { id: '2', filename: 'huge.zip', mimeType: 'application/zip', size: 100 * 1024 * 1024, path: 'files/huge.zip' },
          ],
          count: 2,
          totalSize: 100 * 1024 * 1024 + 1024,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.files!.count).toBe(1);
      expect(result.contents.files!.files[0].filename).toBe('small.txt');
      expect(result.metadata.warnings.some((w) => w.includes('huge.zip'))).toBe(true);
    });

    it('maps GPTs to project configurations', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.customBots).toBeDefined();
      expect(result.contents.customBots!.count).toBe(1);
    });

    it('warns about multiple GPTs', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        customBots: {
          bots: [
            { id: '1', name: 'GPT 1', instructions: 'First', createdAt: '2024-01-01' },
            { id: '2', name: 'GPT 2', instructions: 'Second', createdAt: '2024-01-01' },
          ],
          count: 2,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.metadata.warnings.some((w) => w.includes('2 GPTs'))).toBe(true);
    });

    it('calls progress callback during transformation', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();
      const onProgress = vi.fn();

      await transformer.transform(bundle, { ...defaultTransformOptions, onProgress });

      expect(onProgress).toHaveBeenCalled();
      // Check that progress reaches 100%
      expect(onProgress).toHaveBeenCalledWith(1.0, expect.any(String));
    });

    it('preserves extras from source bundle', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle();
      bundle.contents.extras = { customData: 'preserved' };

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.extras?.customData).toBe('preserved');
    });

    it('handles empty bundle contents gracefully', async () => {
      const transformer = new ChatGPTToClaudeTransformer();
      const bundle = createChatGPTBundle({
        instructions: undefined,
        memories: undefined,
        conversations: undefined,
        files: undefined,
        customBots: undefined,
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.target?.platform).toBe('claude');
      expect(result.contents.instructions).toBeUndefined();
      expect(result.contents.memories).toBeUndefined();
    });
  });
});
