/**
 * Tests for Claude → ChatGPT Transformer
 */

import { describe, it, expect, vi } from 'vitest';
import { ClaudeToChatGPTTransformer } from '../claude-to-chatgpt.js';
import type { MigrationBundle, TransformOptions } from '../../types.js';

// ─── Test Fixtures ───────────────────────────────────────────

function createClaudeBundle(
  overrides: Partial<MigrationBundle['contents']> = {},
): MigrationBundle {
  return {
    version: '1.0',
    id: 'test-claude-bundle',
    source: {
      platform: 'claude',
      extractedAt: '2024-01-15T10:00:00Z',
      extractorVersion: '1.0.0',
    },
    contents: {
      instructions: {
        content: `# User Context
I am a senior software engineer working on enterprise applications.

# Response Guidelines
Be precise and technical. Use code examples when helpful.`,
        length: 150,
      },
      memories: {
        entries: [
          { id: 'm1', content: 'User prefers TypeScript over JavaScript', createdAt: '2024-01-01', category: 'Preferences' },
          { id: 'm2', content: 'User works on a team of 10 developers', createdAt: '2024-01-02', category: 'Work' },
        ],
        count: 2,
      },
      conversations: {
        path: 'conversations/',
        count: 3,
        messageCount: 50,
        summaries: [
          {
            id: 'c1',
            title: 'Architecture Review',
            messageCount: 15,
            createdAt: '2024-01-10',
            updatedAt: '2024-01-10',
            keyPoints: ['Chose microservices architecture', 'Will use Kubernetes'],
          },
        ],
      },
      files: {
        files: [
          {
            id: 'f1',
            filename: 'architecture.md',
            mimeType: 'text/markdown',
            size: 2048,
            path: 'files/architecture.md',
          },
        ],
        count: 1,
        totalSize: 2048,
      },
      customBots: {
        bots: [
          {
            id: 'proj1',
            name: 'Backend Project',
            description: 'Project for backend development',
            instructions: 'Assist with Node.js backend development.',
            createdAt: '2024-01-01',
          },
        ],
        count: 1,
      },
      ...overrides,
    },
    metadata: {
      totalItems: 8,
      itemCounts: {
        instructions: 1,
        memories: 2,
        conversations: 3,
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

describe('ClaudeToChatGPTTransformer', () => {
  describe('properties', () => {
    it('has correct source and target platforms', () => {
      const transformer = new ClaudeToChatGPTTransformer();

      expect(transformer.source).toBe('claude');
      expect(transformer.target).toBe('chatgpt');
      expect(transformer.version).toBe('1.0.0');
    });
  });

  // ─── Analysis ────────────────────────────────────────────

  describe('analyze', () => {
    it('returns compatibility report for valid bundle', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();

      const report = await transformer.analyze(bundle);

      expect(report.source).toBe('claude');
      expect(report.target).toBe('chatgpt');
      expect(report.summary.total).toBeGreaterThan(0);
    });

    it('marks short system prompt as perfect', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'Be helpful and concise.', length: 25 },
      });

      const report = await transformer.analyze(bundle);
      const item = report.items.find((i) => i.type === 'instructions');

      expect(item?.status).toBe('perfect');
    });

    it('marks long system prompt as adapted', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'A'.repeat(2000), length: 2000 },
      });

      const report = await transformer.analyze(bundle);
      const item = report.items.find((i) => i.type === 'instructions');

      expect(item?.status).toBe('adapted');
      expect(item?.reason).toContain('overflow');
    });

    it('marks memories within limit as perfect', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        memories: {
          entries: Array.from({ length: 50 }, (_, i) => ({
            id: `m${i}`,
            content: `Memory ${i}`,
            createdAt: '2024-01-01',
          })),
          count: 50,
        },
      });

      const report = await transformer.analyze(bundle);
      const item = report.items.find((i) => i.type === 'memory');

      expect(item?.status).toBe('perfect');
    });

    it('marks memories exceeding limit as adapted', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        memories: {
          entries: Array.from({ length: 150 }, (_, i) => ({
            id: `m${i}`,
            content: `Memory ${i}`,
            createdAt: '2024-01-01',
          })),
          count: 150,
        },
      });

      const report = await transformer.analyze(bundle);
      const item = report.items.find((i) => i.type === 'memory');

      expect(item?.status).toBe('adapted');
    });

    it('marks conversations as adapted (no import support)', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();

      const report = await transformer.analyze(bundle);
      const item = report.items.find((i) => i.type === 'conversation');

      expect(item?.status).toBe('adapted');
      expect(item?.reason).toContain('not supported');
    });

    it('provides recommendations for long system prompts', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'A'.repeat(2000), length: 2000 },
      });

      const report = await transformer.analyze(bundle);

      expect(report.recommendations.some((r) => r.includes('1500'))).toBe(true);
      expect(report.recommendations.some((r) => r.includes('GPT'))).toBe(true);
    });
  });

  // ─── Transformation ──────────────────────────────────────

  describe('transform', () => {
    it('transforms valid Claude bundle to ChatGPT format', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.target?.platform).toBe('chatgpt');
      expect(result.target?.transformerVersion).toBe('1.0.0');
    });

    it('rejects non-Claude bundles', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();
      bundle.source.platform = 'chatgpt';

      await expect(transformer.transform(bundle, defaultTransformOptions)).rejects.toThrow(
        'Expected Claude bundle',
      );
    });

    it('converts system prompt to ChatGPT custom instructions format', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      const content = result.contents.instructions?.content || '';
      expect(content).toContain('About Me');
      expect(content).toContain('How ChatGPT Should Respond');
    });

    it('truncates oversized system prompt', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'A'.repeat(3000), length: 3000 },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.instructions!.length).toBeLessThanOrEqual(1500);
    });

    it('stores instruction overflow for reference', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'A'.repeat(3000), length: 3000 },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.extras?.instructionOverflow).toBeDefined();
    });

    it('creates memories from instruction overflow when no memories exist', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'Important context. '.repeat(100), length: 1900 },
        memories: undefined,
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.memories).toBeDefined();
      expect(result.contents.memories!.count).toBeGreaterThan(0);
    });

    it('respects memory limit', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        memories: {
          entries: Array.from({ length: 150 }, (_, i) => ({
            id: `m${i}`,
            content: `Memory ${i}`,
            createdAt: '2024-01-01',
          })),
          count: 150,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.memories!.count).toBeLessThanOrEqual(100);
      expect(result.metadata.warnings.some((w) => w.includes('Memory limit'))).toBe(true);
    });

    it('splits long memory entries', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const longContent = 'A'.repeat(800); // Over 500 char per-memory limit
      const bundle = createClaudeBundle({
        memories: {
          entries: [
            { id: 'm1', content: longContent, createdAt: '2024-01-01' },
          ],
          count: 1,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      // Should be split into multiple entries
      expect(result.contents.memories!.count).toBeGreaterThan(1);
      expect(result.contents.memories!.entries[0].content).toContain('[Part 1/');
    });

    it('preserves conversation data as reference', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.conversations).toBeDefined();
      expect(result.contents.conversations!.count).toBe(3);
      expect(result.metadata.warnings.some((w) => w.includes('cannot be automatically imported'))).toBe(true);
    });

    it('filters oversized files', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        files: {
          files: [
            { id: '1', filename: 'small.txt', mimeType: 'text/plain', size: 1024, path: '' },
            { id: '2', filename: 'huge.zip', mimeType: 'application/zip', size: 600 * 1024 * 1024, path: '' },
          ],
          count: 2,
          totalSize: 600 * 1024 * 1024,
        },
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.files!.count).toBe(1);
      expect(result.contents.files!.files[0].filename).toBe('small.txt');
    });

    it('transforms projects to GPT config suggestions', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.customBots).toBeDefined();
      expect(result.contents.customBots!.bots[0].description).toContain('Migrate to GPT');
      expect(result.metadata.warnings.some((w) => w.includes('Manual GPT creation'))).toBe(true);
    });

    it('calls progress callback during transformation', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();
      const onProgress = vi.fn();

      await transformer.transform(bundle, { ...defaultTransformOptions, onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(1.0, expect.any(String));
    });

    it('throws with error strategy on overflow', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: { content: 'A'.repeat(3000), length: 3000 },
      });

      await expect(
        transformer.transform(bundle, {
          ...defaultTransformOptions,
          overflowStrategy: 'error',
        }),
      ).rejects.toThrow('exceed limit');
    });

    it('handles empty bundle gracefully', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle({
        instructions: undefined,
        memories: undefined,
        conversations: undefined,
        files: undefined,
        customBots: undefined,
      });

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.target?.platform).toBe('chatgpt');
    });

    it('preserves existing extras', async () => {
      const transformer = new ClaudeToChatGPTTransformer();
      const bundle = createClaudeBundle();
      bundle.contents.extras = { customField: 'value' };

      const result = await transformer.transform(bundle, defaultTransformOptions);

      expect(result.contents.extras?.customField).toBe('value');
    });
  });
});
