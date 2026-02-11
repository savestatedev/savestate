/**
 * Integration Tests for Migration Wizard
 *
 * Tests complete migration paths between platforms with realistic data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { MigrationOrchestrator, type MigrationEvent } from '../orchestrator.js';
import { registerMockPlugins, MockExtractor, MockLoader } from '../testing/index.js';
import { ChatGPTToClaudeTransformer } from '../transformers/chatgpt-to-claude.js';
import { ClaudeToChatGPTTransformer } from '../transformers/claude-to-chatgpt.js';
import { registerTransformer } from '../transformers/registry.js';
import type {
  MigrationBundle,
  MemoryEntry,
  ConversationSummary,
  CustomBotEntry,
  FileEntry,
} from '../types.js';

describe('Integration Tests', () => {
  let testWorkDir: string;

  beforeEach(async () => {
    testWorkDir = join(
      tmpdir(),
      `savestate-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testWorkDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testWorkDir)) {
      await rm(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('ChatGPT → Claude Full Migration', () => {
    it('should migrate typical user data from ChatGPT to Claude', async () => {
      // Create realistic ChatGPT data
      const typicalUserBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_chatgpt_typical',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          accountId: 'user_12345',
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: `## About Me
I am a software developer working on web applications. I prefer TypeScript and React.
I live in San Francisco and work remotely.

## How ChatGPT Should Respond
Be concise but thorough. Use code examples when helpful.
Always explain the reasoning behind suggestions.
Format code with proper indentation.`,
            length: 300,
            sections: [
              { title: 'About Me', content: 'Software developer...', priority: 'high' },
              { title: 'Response Style', content: 'Be concise...', priority: 'medium' },
            ],
          },
          memories: {
            entries: [
              {
                id: 'mem_1',
                content: 'User prefers TypeScript over JavaScript',
                createdAt: '2024-01-15T10:00:00Z',
                category: 'preferences',
              },
              {
                id: 'mem_2',
                content: 'User is building a Next.js e-commerce platform',
                createdAt: '2024-01-20T14:30:00Z',
                category: 'projects',
              },
              {
                id: 'mem_3',
                content: 'User timezone is PST (UTC-8)',
                createdAt: '2024-02-01T09:00:00Z',
                category: 'context',
              },
            ],
            count: 3,
          },
          conversations: {
            path: 'conversations/',
            count: 15,
            messageCount: 150,
            summaries: [
              {
                id: 'conv_1',
                title: 'React State Management',
                messageCount: 25,
                createdAt: '2024-01-10T10:00:00Z',
                updatedAt: '2024-01-10T12:00:00Z',
                keyPoints: ['Decided to use Zustand for state management'],
              },
              {
                id: 'conv_2',
                title: 'Database Design',
                messageCount: 40,
                createdAt: '2024-01-12T09:00:00Z',
                updatedAt: '2024-01-12T16:00:00Z',
                keyPoints: ['Using Prisma with PostgreSQL'],
              },
            ],
          },
          files: {
            files: [
              {
                id: 'file_1',
                filename: 'schema.prisma',
                mimeType: 'text/plain',
                size: 4096,
                path: 'files/schema.prisma',
              },
              {
                id: 'file_2',
                filename: 'api-docs.pdf',
                mimeType: 'application/pdf',
                size: 524288,
                path: 'files/api-docs.pdf',
              },
            ],
            count: 2,
            totalSize: 528384,
          },
          customBots: {
            bots: [
              {
                id: 'gpt_1',
                name: 'Code Reviewer',
                description: 'Reviews code for best practices',
                instructions: 'You are a senior code reviewer...',
                capabilities: ['code_interpreter'],
                createdAt: '2024-01-05T10:00:00Z',
              },
            ],
            count: 1,
          },
        },
        metadata: {
          totalItems: 22,
          itemCounts: {
            instructions: 1,
            memories: 3,
            conversations: 15,
            files: 2,
            customBots: 1,
          },
          warnings: [],
          errors: [],
        },
      };

      // Register mock extractor with this bundle
      const { loaders } = registerMockPlugins({
        extractors: {
          chatgpt: { customBundle: typicalUserBundle },
        },
      });

      // Also register the real ChatGPT→Claude transformer
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-chatgpt-claude'),
      });

      const events: MigrationEvent[] = [];
      orchestrator.on((e) => events.push(e));

      const result = await orchestrator.run();

      // Verify success
      expect(result.success).toBe(true);
      expect(result.loaded.instructions).toBe(true);
      expect(result.loaded.memories).toBeGreaterThan(0);
      expect(result.loaded.files).toBe(2);

      // Verify state
      const state = orchestrator.getState();
      expect(state.phase).toBe('complete');
      expect(state.checkpoints.length).toBe(3);

      // Verify the bundle was transformed correctly
      const bundle = orchestrator.getBundle();
      expect(bundle?.target?.platform).toBe('claude');
      expect(bundle?.contents.instructions).toBeDefined();

      // Verify phase events
      const phaseStarts = events.filter((e) => e.type === 'phase:start');
      expect(phaseStarts.length).toBe(3);
    });

    it('should preserve custom bot configurations during migration', async () => {
      const bundleWithMultipleGPTs: MigrationBundle = {
        version: '1.0',
        id: 'bundle_gpts',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          customBots: {
            bots: [
              {
                id: 'gpt_writer',
                name: 'Creative Writer',
                description: 'Helps with creative writing',
                instructions:
                  'You are a creative writing assistant. Help with stories, poems, and creative content.',
                capabilities: ['browsing'],
                createdAt: '2024-01-01T10:00:00Z',
              },
              {
                id: 'gpt_data',
                name: 'Data Analyst',
                description: 'Analyzes data and creates visualizations',
                instructions:
                  'You are a data analyst. Process data, create charts, and provide insights.',
                capabilities: ['code_interpreter'],
                createdAt: '2024-01-02T10:00:00Z',
              },
            ],
            count: 2,
          },
        },
        metadata: {
          totalItems: 2,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 0,
            files: 0,
            customBots: 2,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: bundleWithMultipleGPTs } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-gpts'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      expect(result.loaded.customBots).toBe(2);

      const bundle = orchestrator.getBundle();
      expect(bundle?.contents.customBots?.count).toBe(2);
    });
  });

  describe('Claude → ChatGPT Full Migration', () => {
    it('should migrate typical user data from Claude to ChatGPT', async () => {
      const claudeBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_claude_typical',
        source: {
          platform: 'claude',
          extractedAt: new Date().toISOString(),
          accountId: 'org_abc123',
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: `You are assisting a product manager at a tech startup.

Key context:
- The user manages a team of 5 engineers
- Main product is a B2B SaaS platform
- Currently in Series A funding stage

Response guidelines:
- Be direct and action-oriented
- Use bullet points for clarity
- Consider business impact in suggestions`,
            length: 350,
          },
          memories: {
            entries: [
              {
                id: 'claude_mem_1',
                content: 'User manages product roadmap quarterly',
                createdAt: '2024-02-01T10:00:00Z',
              },
              {
                id: 'claude_mem_2',
                content: 'Team uses Jira for project tracking',
                createdAt: '2024-02-05T14:00:00Z',
              },
            ],
            count: 2,
          },
          files: {
            files: [
              {
                id: 'claude_file_1',
                filename: 'roadmap-q1.md',
                mimeType: 'text/markdown',
                size: 8192,
                path: 'files/roadmap-q1.md',
              },
            ],
            count: 1,
            totalSize: 8192,
          },
        },
        metadata: {
          totalItems: 4,
          itemCounts: {
            instructions: 1,
            memories: 2,
            conversations: 0,
            files: 1,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { claude: { customBundle: claudeBundle } },
      });
      registerTransformer('claude', 'chatgpt', () => new ClaudeToChatGPTTransformer());

      const orchestrator = new MigrationOrchestrator('claude', 'chatgpt', {
        workDir: join(testWorkDir, 'migration-claude-chatgpt'),
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      expect(result.loaded.instructions).toBe(true);
      expect(result.loaded.memories).toBe(2);
      expect(result.loaded.files).toBe(1);

      const bundle = orchestrator.getBundle();
      expect(bundle?.target?.platform).toBe('chatgpt');
    });

    it('should handle Claude projects mapped to ChatGPT', async () => {
      const claudeWithProjects: MigrationBundle = {
        version: '1.0',
        id: 'bundle_claude_projects',
        source: {
          platform: 'claude',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          customBots: {
            bots: [
              {
                id: 'proj_research',
                name: 'Research Assistant',
                description: 'Helps with academic research',
                instructions: 'Focus on peer-reviewed sources and citations',
                createdAt: '2024-01-15T10:00:00Z',
              },
            ],
            count: 1,
          },
        },
        metadata: {
          totalItems: 1,
          itemCounts: {
            instructions: 0,
            memories: 0,
            conversations: 0,
            files: 0,
            customBots: 1,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { claude: { customBundle: claudeWithProjects } },
      });
      registerTransformer('claude', 'chatgpt', () => new ClaudeToChatGPTTransformer());

      const orchestrator = new MigrationOrchestrator('claude', 'chatgpt', {
        workDir: join(testWorkDir, 'migration-projects'),
      });

      const result = await orchestrator.run();
      expect(result.success).toBe(true);
    });
  });

  describe('Dry Run Mode', () => {
    it('should show accurate compatibility report in dry run', async () => {
      const bundleWithMixedCompatibility: MigrationBundle = {
        version: '1.0',
        id: 'bundle_mixed',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: 'A'.repeat(10000), // Long instructions that will need adaptation
            length: 10000,
          },
          memories: {
            entries: Array.from({ length: 25 }, (_, i) => ({
              id: `mem_${i}`,
              content: `Memory entry ${i}`,
              createdAt: new Date().toISOString(),
            })),
            count: 25,
          },
          files: {
            files: [
              {
                id: 'large_file',
                filename: 'huge-dataset.csv',
                mimeType: 'text/csv',
                size: 100 * 1024 * 1024, // 100MB - exceeds Claude's limit
                path: 'files/huge-dataset.csv',
              },
              {
                id: 'normal_file',
                filename: 'readme.md',
                mimeType: 'text/markdown',
                size: 1024,
                path: 'files/readme.md',
              },
            ],
            count: 2,
            totalSize: 100 * 1024 * 1024 + 1024,
          },
        },
        metadata: {
          totalItems: 28,
          itemCounts: {
            instructions: 1,
            memories: 25,
            conversations: 0,
            files: 2,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: bundleWithMixedCompatibility } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-dry-run'),
        dryRun: true,
      });

      // First get the compatibility report
      const report = await orchestrator.analyze();

      expect(report.source).toBe('chatgpt');
      expect(report.target).toBe('claude');
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.items.some((i) => i.status === 'adapted')).toBe(true);
      expect(report.items.some((i) => i.status === 'incompatible')).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);

      // Now run the dry migration
      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dry run - no changes made');
    });

    it('should not create any resources in dry run mode', async () => {
      registerMockPlugins();

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-dry-run-resources'),
        dryRun: true,
      });

      const result = await orchestrator.run();

      expect(result.success).toBe(true);
      expect(result.created).toBeUndefined();
    });
  });

  describe('Bidirectional Migration', () => {
    it('should support round-trip migration ChatGPT → Claude → ChatGPT', async () => {
      const originalBundle: MigrationBundle = {
        version: '1.0',
        id: 'bundle_roundtrip',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: {
            content: 'I am a helpful assistant for a software engineer.',
            length: 50,
          },
          memories: {
            entries: [
              {
                id: 'mem_rt',
                content: 'User prefers detailed explanations',
                createdAt: new Date().toISOString(),
              },
            ],
            count: 1,
          },
        },
        metadata: {
          totalItems: 2,
          itemCounts: {
            instructions: 1,
            memories: 1,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      // First migration: ChatGPT → Claude
      registerMockPlugins({
        extractors: { chatgpt: { customBundle: originalBundle } },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());
      registerTransformer('claude', 'chatgpt', () => new ClaudeToChatGPTTransformer());

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', {
        workDir: join(testWorkDir, 'migration-roundtrip-1'),
      });

      const result1 = await orchestrator1.run();
      expect(result1.success).toBe(true);

      const claudeBundle = orchestrator1.getBundle()!;
      expect(claudeBundle.target?.platform).toBe('claude');

      // Second migration: Claude → ChatGPT (using the transformed bundle)
      registerMockPlugins({
        extractors: {
          claude: {
            customBundle: {
              ...claudeBundle,
              source: {
                platform: 'claude',
                extractedAt: new Date().toISOString(),
                extractorVersion: '1.0.0',
              },
            },
          },
        },
      });

      const orchestrator2 = new MigrationOrchestrator('claude', 'chatgpt', {
        workDir: join(testWorkDir, 'migration-roundtrip-2'),
      });

      const result2 = await orchestrator2.run();
      expect(result2.success).toBe(true);

      const finalBundle = orchestrator2.getBundle()!;
      expect(finalBundle.target?.platform).toBe('chatgpt');

      // Core data should be preserved
      expect(finalBundle.contents.instructions).toBeDefined();
    });
  });
});
