/**
 * ChatGPT Extractor Tests
 *
 * Tests for extracting data from ChatGPT:
 * - Custom instructions
 * - Memory entries
 * - Conversation history
 * - Files/attachments
 * - Custom GPTs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ChatGPTExtractor } from '../chatgpt.js';

describe('ChatGPTExtractor', () => {
  let testDir: string;
  let exportDir: string;
  let workDir: string;

  beforeEach(async () => {
    // Create unique temp directories for each test
    const testId = `savestate-chatgpt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), testId);
    exportDir = join(testDir, 'export');
    workDir = join(testDir, 'work');

    await mkdir(exportDir, { recursive: true });
    await mkdir(workDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  // ─── Helper Functions ────────────────────────────────────────

  async function createMockExport(options: {
    conversations?: boolean;
    memories?: boolean;
    instructions?: boolean;
    files?: boolean;
    gpts?: boolean;
    conversationCount?: number;
    largeConversations?: boolean;
  } = {}) {
    const {
      conversations = true,
      memories = true,
      instructions = true,
      files = false,
      gpts = false,
      conversationCount = 3,
      largeConversations = false,
    } = options;

    // Create conversations.json
    if (conversations) {
      const convs = [];
      for (let i = 0; i < conversationCount; i++) {
        const msgCount = largeConversations ? 100 : 5;
        const mapping: Record<string, unknown> = {};

        // Create root node
        mapping['root'] = {
          id: 'root',
          children: ['msg_1'],
        };

        // Create message chain
        for (let j = 1; j <= msgCount; j++) {
          const role = j % 2 === 1 ? 'user' : 'assistant';
          mapping[`msg_${j}`] = {
            id: `msg_${j}`,
            message: {
              id: `msg_${j}`,
              author: { role },
              create_time: Date.now() / 1000 + j,
              content: {
                content_type: 'text',
                parts: [`Test message ${j} from ${role} in conversation ${i + 1}`],
              },
              metadata: role === 'assistant' ? { model_slug: 'gpt-4' } : undefined,
            },
            parent: j === 1 ? 'root' : `msg_${j - 1}`,
            children: j < msgCount ? [`msg_${j + 1}`] : [],
          };
        }

        convs.push({
          id: `conv_${i + 1}`,
          title: `Test Conversation ${i + 1}`,
          create_time: Date.now() / 1000,
          update_time: Date.now() / 1000 + 3600,
          mapping,
          current_node: `msg_${msgCount}`,
        });
      }

      await writeFile(
        join(exportDir, 'conversations.json'),
        JSON.stringify(convs),
      );
    }

    // Create memories.json
    if (memories) {
      const mems = [
        {
          id: 'mem_1',
          content: 'User prefers TypeScript over JavaScript',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'mem_2',
          content: 'User is working on a project called SaveState',
          created_at: '2024-01-16T10:00:00Z',
          updated_at: '2024-01-17T10:00:00Z',
        },
        {
          id: 'mem_3',
          content: 'User lives in Austin, Texas',
          created_at: '2024-01-18T10:00:00Z',
        },
      ];

      await writeFile(join(exportDir, 'memories.json'), JSON.stringify(mems));
    }

    // Create user.json with custom instructions
    if (instructions) {
      const user = {
        custom_instructions: {
          about_user:
            'I am a software developer specializing in AI systems. I prefer concise, technical responses.',
          about_model:
            'Be direct and technical. Provide code examples when relevant. Avoid unnecessary pleasantries.',
        },
      };

      await writeFile(join(exportDir, 'user.json'), JSON.stringify(user));
    }

    // Create files directory
    if (files) {
      const filesDir = join(exportDir, 'files');
      await mkdir(filesDir, { recursive: true });

      await writeFile(join(filesDir, 'project-notes.md'), '# Project Notes\n\nThis is a test file.');
      await writeFile(join(filesDir, 'data.json'), JSON.stringify({ key: 'value' }));
    }

    // Create gpts.json
    if (gpts) {
      const gptList = [
        {
          id: 'gpt_1',
          name: 'Code Review Helper',
          description: 'Helps review code and suggest improvements',
          instructions:
            'You are a code review assistant. Focus on code quality, best practices, and security.',
          tools: ['python', 'browser'],
          knowledge_files: [{ id: 'file_1', name: 'coding-standards.pdf' }],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
        },
        {
          id: 'gpt_2',
          name: 'Writing Assistant',
          description: 'Helps with writing and editing',
          instructions:
            'You are a writing assistant. Help improve clarity, grammar, and style.',
          tools: [],
          created_at: '2024-02-01T00:00:00Z',
        },
      ];

      await writeFile(join(exportDir, 'gpts.json'), JSON.stringify(gptList));
    }
  }

  // ─── Basic Extraction Tests ──────────────────────────────────

  describe('canExtract', () => {
    it('should return true when export path exists', async () => {
      await createMockExport();
      const extractor = new ChatGPTExtractor({ exportPath: exportDir });

      const result = await extractor.canExtract();

      expect(result).toBe(true);
    });

    it('should return false when export path does not exist', async () => {
      const extractor = new ChatGPTExtractor({
        exportPath: '/non/existent/path',
      });

      const result = await extractor.canExtract();

      expect(result).toBe(false);
    });

    it('should return false when no credentials or export path provided', async () => {
      const extractor = new ChatGPTExtractor({});

      const result = await extractor.canExtract();

      expect(result).toBe(false);
    });
  });

  describe('extract', () => {
    it('should extract all data from a complete export', async () => {
      await createMockExport({
        conversations: true,
        memories: true,
        instructions: true,
        files: true,
        gpts: true,
      });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      // Verify bundle structure
      expect(bundle.version).toBe('1.0');
      expect(bundle.source.platform).toBe('chatgpt');
      expect(bundle.source.extractorVersion).toBe('1.0.0');

      // Verify contents
      expect(bundle.contents.instructions).toBeDefined();
      expect(bundle.contents.memories).toBeDefined();
      expect(bundle.contents.conversations).toBeDefined();
      expect(bundle.contents.files).toBeDefined();
      expect(bundle.contents.customBots).toBeDefined();

      // Verify metadata
      expect(bundle.metadata.totalItems).toBeGreaterThan(0);
      expect(bundle.metadata.errors).toHaveLength(0);
    });

    it('should handle partial exports gracefully', async () => {
      // Only create conversations, no other data
      await createMockExport({
        conversations: true,
        memories: false,
        instructions: false,
        files: false,
        gpts: false,
      });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      expect(bundle.contents.conversations).toBeDefined();
      expect(bundle.contents.conversations?.count).toBe(3);

      // Other contents should be undefined (not errors)
      expect(bundle.metadata.errors).toHaveLength(0);
    });

    it('should respect include filter', async () => {
      await createMockExport();

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({
        workDir,
        include: ['instructions', 'memories'],
      });

      expect(bundle.contents.instructions).toBeDefined();
      expect(bundle.contents.memories).toBeDefined();
      expect(bundle.contents.conversations).toBeUndefined();
      expect(bundle.contents.files).toBeUndefined();
      expect(bundle.contents.customBots).toBeUndefined();
    });
  });

  // ─── Instructions Extraction ─────────────────────────────────

  describe('instructions extraction', () => {
    it('should extract custom instructions from user.json', async () => {
      await createMockExport({ instructions: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const instructions = bundle.contents.instructions;
      expect(instructions).toBeDefined();
      expect(instructions?.content).toContain('software developer');
      expect(instructions?.content).toContain('direct and technical');
      expect(instructions?.length).toBeGreaterThan(0);
    });

    it('should parse instruction sections', async () => {
      await createMockExport({ instructions: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const sections = bundle.contents.instructions?.sections ?? [];
      expect(sections.length).toBeGreaterThan(0);

      const titles = sections.map((s) => s.title);
      expect(titles).toContain('About Me');
      expect(titles).toContain('How ChatGPT Should Respond');
    });
  });

  // ─── Memories Extraction ─────────────────────────────────────

  describe('memories extraction', () => {
    it('should extract all memory entries', async () => {
      await createMockExport({ memories: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const memories = bundle.contents.memories;
      expect(memories).toBeDefined();
      expect(memories?.count).toBe(3);
      expect(memories?.entries).toHaveLength(3);
    });

    it('should preserve memory metadata', async () => {
      await createMockExport({ memories: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const entries = bundle.contents.memories?.entries ?? [];
      const updatedEntry = entries.find((e) => e.id === 'mem_2');

      expect(updatedEntry).toBeDefined();
      expect(updatedEntry?.content).toContain('SaveState');
      expect(updatedEntry?.createdAt).toBeDefined();
      expect(updatedEntry?.updatedAt).toBeDefined();
    });
  });

  // ─── Conversations Extraction ────────────────────────────────

  describe('conversations extraction', () => {
    it('should extract all conversations', async () => {
      await createMockExport({ conversationCount: 5 });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const conversations = bundle.contents.conversations;
      expect(conversations).toBeDefined();
      expect(conversations?.count).toBe(5);
      expect(conversations?.summaries).toHaveLength(5);
    });

    it('should save individual conversation files', async () => {
      await createMockExport({ conversationCount: 3 });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      await extractor.extract({ workDir });

      const convDir = join(workDir, 'conversations');
      const files = await readdir(convDir);

      expect(files).toHaveLength(3);
      expect(files.every((f) => f.endsWith('.json'))).toBe(true);
    });

    it('should extract messages in correct order', async () => {
      await createMockExport({ conversationCount: 1 });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      await extractor.extract({ workDir });

      const convFile = join(workDir, 'conversations', 'conv_1.json');
      const convData = JSON.parse(await readFile(convFile, 'utf-8'));

      expect(convData.messages).toBeDefined();
      expect(convData.messages.length).toBeGreaterThan(0);

      // Check alternating roles
      const roles = convData.messages.map((m: { role: string }) => m.role);
      expect(roles[0]).toBe('user');
      expect(roles[1]).toBe('assistant');
    });

    it('should count total messages correctly', async () => {
      await createMockExport({ conversationCount: 2 });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const conversations = bundle.contents.conversations;
      // 2 conversations × 5 messages each = 10 messages
      expect(conversations?.messageCount).toBe(10);
    });

    it('should respect maxConversations limit', async () => {
      await createMockExport({ conversationCount: 10 });

      const extractor = new ChatGPTExtractor({
        exportPath: exportDir,
        maxConversations: 3,
      });
      const bundle = await extractor.extract({ workDir });

      expect(bundle.contents.conversations?.count).toBe(3);
    });

    it('should generate conversation summaries', async () => {
      await createMockExport({ conversationCount: 2 });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const summaries = bundle.contents.conversations?.summaries ?? [];
      expect(summaries).toHaveLength(2);

      for (const summary of summaries) {
        expect(summary.id).toBeDefined();
        expect(summary.title).toBeDefined();
        expect(summary.messageCount).toBeGreaterThan(0);
        expect(summary.createdAt).toBeDefined();
        expect(summary.updatedAt).toBeDefined();
      }
    });
  });

  // ─── Files Extraction ────────────────────────────────────────

  describe('files extraction', () => {
    it('should extract files from export', async () => {
      await createMockExport({ files: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const files = bundle.contents.files;
      expect(files).toBeDefined();
      expect(files?.count).toBe(2);
      expect(files?.totalSize).toBeGreaterThan(0);
    });

    it('should copy files to work directory', async () => {
      await createMockExport({ files: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      await extractor.extract({ workDir });

      const filesDir = join(workDir, 'files');
      const files = await readdir(filesDir);

      expect(files).toContain('project-notes.md');
      expect(files).toContain('data.json');
    });

    it('should detect MIME types correctly', async () => {
      await createMockExport({ files: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const files = bundle.contents.files?.files ?? [];
      const mdFile = files.find((f) => f.filename === 'project-notes.md');
      const jsonFile = files.find((f) => f.filename === 'data.json');

      expect(mdFile?.mimeType).toBe('text/markdown');
      expect(jsonFile?.mimeType).toBe('application/json');
    });
  });

  // ─── Custom GPTs Extraction ──────────────────────────────────

  describe('custom GPTs extraction', () => {
    it('should extract custom GPTs from export', async () => {
      await createMockExport({ gpts: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const customBots = bundle.contents.customBots;
      expect(customBots).toBeDefined();
      expect(customBots?.count).toBe(2);
    });

    it('should preserve GPT details', async () => {
      await createMockExport({ gpts: true });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const bots = bundle.contents.customBots?.bots ?? [];
      const codeReviewer = bots.find((b) => b.id === 'gpt_1');

      expect(codeReviewer).toBeDefined();
      expect(codeReviewer?.name).toBe('Code Review Helper');
      expect(codeReviewer?.description).toContain('review code');
      expect(codeReviewer?.instructions).toContain('code review assistant');
      expect(codeReviewer?.capabilities).toContain('python');
      expect(codeReviewer?.knowledgeFiles).toContain('coding-standards.pdf');
      expect(codeReviewer?.createdAt).toBeDefined();
      expect(codeReviewer?.updatedAt).toBeDefined();
    });
  });

  // ─── Progress Tracking ───────────────────────────────────────

  describe('progress tracking', () => {
    it('should report progress during extraction', async () => {
      await createMockExport();

      const progressEvents: Array<{ progress: number; message: string }> = [];

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      await extractor.extract({
        workDir,
        onProgress: (progress, message) => {
          progressEvents.push({ progress, message });
        },
      });

      expect(progressEvents.length).toBeGreaterThan(0);

      // Progress should increase (with small tolerance for floating point)
      const progressValues = progressEvents.map((e) => e.progress);
      for (let i = 1; i < progressValues.length; i++) {
        // Allow small floating point tolerance (0.0001)
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1] - 0.0001);
      }

      // Final progress should be 1.0
      expect(progressValues[progressValues.length - 1]).toBe(1.0);
    });

    it('should track progress via getProgress()', async () => {
      await createMockExport();

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });

      // Before extraction
      expect(extractor.getProgress()).toBe(0);

      await extractor.extract({ workDir });

      // After extraction
      expect(extractor.getProgress()).toBe(100);
    });
  });

  // ─── Error Handling ──────────────────────────────────────────

  describe('error handling', () => {
    it('should handle missing conversations.json gracefully', async () => {
      // Create export without conversations
      await createMockExport({
        conversations: false,
        memories: true,
      });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      // Should have memories but not conversations (not an error)
      expect(bundle.contents.memories).toBeDefined();
      expect(bundle.contents.conversations).toBeUndefined();
    });

    it('should handle corrupted JSON files', async () => {
      await createMockExport();

      // Corrupt the conversations file
      await writeFile(
        join(exportDir, 'conversations.json'),
        'not valid json {{{',
      );

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      // Should complete with errors logged
      expect(bundle.metadata.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty exports', async () => {
      // Create empty export directory (no files)
      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      // Should complete without crashing
      expect(bundle.version).toBe('1.0');
      expect(bundle.metadata.totalItems).toBe(0);
    });
  });

  // ─── Metadata ────────────────────────────────────────────────

  describe('metadata', () => {
    it('should generate accurate item counts', async () => {
      await createMockExport({
        conversations: true,
        conversationCount: 5,
        memories: true,
        instructions: true,
        files: true,
        gpts: true,
      });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      expect(bundle.metadata.itemCounts.instructions).toBe(1);
      expect(bundle.metadata.itemCounts.memories).toBe(3);
      expect(bundle.metadata.itemCounts.conversations).toBe(5);
      expect(bundle.metadata.itemCounts.files).toBe(2);
      expect(bundle.metadata.itemCounts.customBots).toBe(2);

      expect(bundle.metadata.totalItems).toBe(1 + 3 + 5 + 2 + 2);
    });

    it('should include extraction timestamp', async () => {
      await createMockExport();

      const before = new Date().toISOString();

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      const after = new Date().toISOString();

      expect(bundle.source.extractedAt).toBeDefined();
      expect(bundle.source.extractedAt >= before).toBe(true);
      expect(bundle.source.extractedAt <= after).toBe(true);
    });

    it('should generate unique bundle IDs', async () => {
      await createMockExport();

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });

      const bundle1 = await extractor.extract({ workDir: join(workDir, 'b1') });
      const bundle2 = await extractor.extract({ workDir: join(workDir, 'b2') });

      expect(bundle1.id).not.toBe(bundle2.id);
      expect(bundle1.id).toMatch(/^bundle_[a-f0-9]+$/);
    });
  });

  // ─── Large Data Handling ─────────────────────────────────────

  describe('large data handling', () => {
    it('should handle many conversations', async () => {
      await createMockExport({ conversationCount: 100 });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      expect(bundle.contents.conversations?.count).toBe(100);
    });

    it('should handle conversations with many messages', async () => {
      await createMockExport({
        conversationCount: 2,
        largeConversations: true,
      });

      const extractor = new ChatGPTExtractor({ exportPath: exportDir });
      const bundle = await extractor.extract({ workDir });

      // 2 conversations × 100 messages each = 200 messages
      expect(bundle.contents.conversations?.messageCount).toBe(200);
    });
  });

  // ─── Extractor Properties ────────────────────────────────────

  describe('extractor properties', () => {
    it('should have correct platform', () => {
      const extractor = new ChatGPTExtractor();
      expect(extractor.platform).toBe('chatgpt');
    });

    it('should have version string', () => {
      const extractor = new ChatGPTExtractor();
      expect(extractor.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
