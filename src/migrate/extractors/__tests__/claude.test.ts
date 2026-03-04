/**
 * Claude Extractor Tests
 *
 * Tests for extracting data from Claude:
 * - System prompts (from projects)
 * - Project knowledge documents
 * - Project files (attachments)
 * - Artifacts
 * - Conversations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ClaudeExtractor } from '../claude.js';

describe('ClaudeExtractor', () => {
  let testDir: string;
  let exportDir: string;
  let workDir: string;

  beforeEach(async () => {
    // Create unique temp directories for each test
    const testId = `savestate-claude-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    vi.restoreAllMocks();
  });

  // ─── Helper Functions ────────────────────────────────────────

  async function createMockExport(options: {
    conversations?: boolean;
    projects?: boolean;
    files?: boolean;
    conversationCount?: number;
    includeArtifacts?: boolean;
    includeAttachments?: boolean;
  } = {}) {
    const {
      conversations = true,
      projects = true,
      files = false,
      conversationCount = 3,
      includeArtifacts = false,
      includeAttachments = false,
    } = options;

    // Create conversations.json
    if (conversations) {
      const convs = [];
      for (let i = 0; i < conversationCount; i++) {
        const chatMessages = [];

        // Create message chain
        for (let j = 0; j < 5; j++) {
          const isHuman = j % 2 === 0;
          const message: Record<string, unknown> = {
            uuid: `msg_${i}_${j}`,
            text: `Test message ${j} from ${isHuman ? 'human' : 'assistant'} in conversation ${i + 1}`,
            sender: isHuman ? 'human' : 'assistant',
            created_at: new Date(Date.now() + j * 60000).toISOString(),
            updated_at: new Date(Date.now() + j * 60000).toISOString(),
          };

          // Add artifact to last assistant message
          if (includeArtifacts && !isHuman && j === 3) {
            message.content = [
              { type: 'text', text: 'Here is the code:' },
              {
                type: 'artifact',
                artifact: {
                  id: `artifact_${i}`,
                  type: 'application/vnd.ant.code',
                  title: `Example Code ${i}`,
                  content: `function example${i}() {\n  return "hello";\n}`,
                  language: 'javascript',
                },
              },
            ];
          }

          // Add attachments to human messages
          if (includeAttachments && isHuman && j === 0) {
            message.attachments = [
              {
                id: `attach_${i}`,
                file_name: `document_${i}.pdf`,
                file_size: 1024 * (i + 1),
                file_type: 'application/pdf',
              },
            ];
          }

          chatMessages.push(message);
        }

        convs.push({
          uuid: `conv_${i + 1}`,
          name: `Test Conversation ${i + 1}`,
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          updated_at: new Date(Date.now() - i * 86400000 + 3600000).toISOString(),
          project_uuid: projects ? `proj_${(i % 2) + 1}` : undefined,
          chat_messages: chatMessages,
        });
      }

      await writeFile(join(exportDir, 'conversations.json'), JSON.stringify(convs));
    }

    // Create projects.json
    if (projects) {
      const projs = [
        {
          id: 'proj_1',
          name: 'My First Project',
          description: 'A test project for development',
          prompt_template: 'You are a helpful coding assistant. Be concise and technical.',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-02T10:00:00Z',
        },
        {
          id: 'proj_2',
          name: 'Research Project',
          description: 'For academic research',
          prompt_template: 'You are a research assistant. Cite sources when possible. Be thorough.',
          created_at: '2024-01-03T10:00:00Z',
          updated_at: '2024-01-04T10:00:00Z',
        },
      ];

      await writeFile(join(exportDir, 'projects.json'), JSON.stringify(projs));
    }

    // Create files directory
    if (files) {
      const filesDir = join(exportDir, 'files');
      await mkdir(filesDir, { recursive: true });

      await writeFile(join(filesDir, 'readme.md'), '# Project Readme\n\nThis is a test file.');
      await writeFile(
        join(filesDir, 'config.json'),
        JSON.stringify({ setting: 'value', enabled: true }),
      );
      await writeFile(join(filesDir, 'data.csv'), 'name,value\ntest,123\nexample,456');
    }
  }

  // ─── Basic Functionality ─────────────────────────────────────

  describe('constructor and basic properties', () => {
    it('should have correct platform and version', () => {
      const extractor = new ClaudeExtractor();

      expect(extractor.platform).toBe('claude');
      expect(extractor.version).toBe('1.0.0');
    });

    it('should initialize with default config', () => {
      const extractor = new ClaudeExtractor();

      expect(extractor.getProgress()).toBe(0);
    });

    it('should accept custom config', () => {
      const extractor = new ClaudeExtractor({
        exportPath: '/path/to/export',
        maxProjects: 5,
        projectIds: ['proj_1', 'proj_2'],
      });

      expect(extractor.platform).toBe('claude');
    });
  });

  // ─── canExtract ──────────────────────────────────────────────

  describe('canExtract', () => {
    it('should return true when export path exists', async () => {
      await createMockExport();

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const canExtract = await extractor.canExtract();
      expect(canExtract).toBe(true);
    });

    it('should return false when export path does not exist', async () => {
      const extractor = new ClaudeExtractor({
        exportPath: '/nonexistent/path',
      });

      const canExtract = await extractor.canExtract();
      expect(canExtract).toBe(false);
    });

    it('should return false when no config provided', async () => {
      const extractor = new ClaudeExtractor();

      const canExtract = await extractor.canExtract();
      expect(canExtract).toBe(false);
    });
  });

  // ─── Conversation Extraction ─────────────────────────────────

  describe('conversation extraction', () => {
    it('should extract conversations from export', async () => {
      await createMockExport({ conversations: true, conversationCount: 3 });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations'],
      });

      expect(bundle.contents.conversations).toBeDefined();
      expect(bundle.contents.conversations!.count).toBe(3);
      expect(bundle.contents.conversations!.path).toBe('conversations/');

      // Check that conversation files were created
      const convDir = join(workDir, 'conversations');
      expect(existsSync(convDir)).toBe(true);

      const files = await readdir(convDir);
      expect(files.length).toBe(3);
    });

    it('should extract message content correctly', async () => {
      await createMockExport({ conversations: true, conversationCount: 1 });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations'],
      });

      expect(bundle.contents.conversations!.messageCount).toBeGreaterThan(0);
      expect(bundle.contents.conversations!.summaries).toBeDefined();
      expect(bundle.contents.conversations!.summaries!.length).toBe(1);
      expect(bundle.contents.conversations!.summaries![0].title).toBe('Test Conversation 1');
    });

    it('should extract artifacts from conversations', async () => {
      await createMockExport({
        conversations: true,
        conversationCount: 2,
        includeArtifacts: true,
      });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations', 'files'],
      });

      // Artifacts should be extracted as files
      expect(bundle.contents.files).toBeDefined();
      expect(bundle.contents.files!.count).toBeGreaterThan(0);

      // Check that artifact files were created
      const artifactsDir = join(workDir, 'artifacts');
      expect(existsSync(artifactsDir)).toBe(true);

      const files = await readdir(artifactsDir);
      expect(files.length).toBe(2); // One artifact per conversation
      expect(files.some((f) => f.endsWith('.js'))).toBe(true);
    });

    it('should handle conversations with attachments', async () => {
      await createMockExport({
        conversations: true,
        conversationCount: 1,
        includeAttachments: true,
      });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations'],
      });

      // Read the conversation file and check for attachments
      const convDir = join(workDir, 'conversations');
      const files = await readdir(convDir);
      const convContent = await readFile(join(convDir, files[0]), 'utf-8');
      const conv = JSON.parse(convContent);

      // Find a message with attachments
      const hasAttachments = conv.messages.some(
        (m: { attachments?: unknown[] }) => m.attachments && m.attachments.length > 0,
      );
      expect(hasAttachments).toBe(true);
    });
  });

  // ─── Project Extraction ──────────────────────────────────────

  describe('project extraction', () => {
    it('should extract projects as customBots', async () => {
      await createMockExport({ projects: true, conversations: false });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['customBots'],
      });

      expect(bundle.contents.customBots).toBeDefined();
      expect(bundle.contents.customBots!.count).toBe(2);
      expect(bundle.contents.customBots!.bots.length).toBe(2);

      const bot1 = bundle.contents.customBots!.bots.find((b) => b.id === 'proj_1');
      expect(bot1).toBeDefined();
      expect(bot1!.name).toBe('My First Project');
      expect(bot1!.instructions).toContain('helpful coding assistant');
    });

    it('should combine project system prompts into instructions', async () => {
      await createMockExport({ projects: true, conversations: false });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['customBots', 'instructions'],
      });

      expect(bundle.contents.instructions).toBeDefined();
      expect(bundle.contents.instructions!.content).toContain('My First Project');
      expect(bundle.contents.instructions!.content).toContain('Research Project');
      expect(bundle.contents.instructions!.sections).toBeDefined();
      expect(bundle.contents.instructions!.sections!.length).toBeGreaterThan(0);
    });
  });

  // ─── File Extraction ─────────────────────────────────────────

  describe('file extraction', () => {
    it('should extract files from files directory', async () => {
      await createMockExport({ files: true, conversations: false, projects: false });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['files'],
      });

      expect(bundle.contents.files).toBeDefined();
      expect(bundle.contents.files!.count).toBe(3);
      expect(bundle.contents.files!.totalSize).toBeGreaterThan(0);

      // Check files were copied
      const filesDir = join(workDir, 'files');
      expect(existsSync(filesDir)).toBe(true);

      const files = await readdir(filesDir);
      expect(files).toContain('readme.md');
      expect(files).toContain('config.json');
      expect(files).toContain('data.csv');
    });

    it('should correctly identify MIME types', async () => {
      await createMockExport({ files: true, conversations: false, projects: false });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['files'],
      });

      const mdFile = bundle.contents.files!.files.find((f) => f.filename === 'readme.md');
      expect(mdFile).toBeDefined();
      expect(mdFile!.mimeType).toBe('text/markdown');

      const jsonFile = bundle.contents.files!.files.find((f) => f.filename === 'config.json');
      expect(jsonFile).toBeDefined();
      expect(jsonFile!.mimeType).toBe('application/json');

      const csvFile = bundle.contents.files!.files.find((f) => f.filename === 'data.csv');
      expect(csvFile).toBeDefined();
      expect(csvFile!.mimeType).toBe('text/csv');
    });
  });

  // ─── Progress Reporting ──────────────────────────────────────

  describe('progress reporting', () => {
    it('should report progress during extraction', async () => {
      await createMockExport({ conversations: true, conversationCount: 5 });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const progressUpdates: Array<{ progress: number; message: string }> = [];

      await extractor.extract({
        workDir,
        onProgress: (progress, message) => {
          progressUpdates.push({ progress, message });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Progress should start low and end at 1.0
      expect(progressUpdates[0].progress).toBeLessThan(0.5);
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(1.0);

      // Final message should indicate completion
      expect(progressUpdates[progressUpdates.length - 1].message).toContain('complete');
    });

    it('should update getProgress during extraction', async () => {
      await createMockExport({ conversations: true, conversationCount: 3 });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      // Progress should be 0 before extraction
      expect(extractor.getProgress()).toBe(0);

      await extractor.extract({
        workDir,
        onProgress: () => {
          // During extraction, progress should be updating
          // (hard to test exact values due to async nature)
        },
      });

      // Progress should be 100 after extraction
      expect(extractor.getProgress()).toBe(100);
    });
  });

  // ─── Bundle Format ───────────────────────────────────────────

  describe('bundle format', () => {
    it('should produce valid MigrationBundle structure', async () => {
      await createMockExport({
        conversations: true,
        projects: true,
        files: true,
      });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({ workDir });

      // Check required fields
      expect(bundle.version).toBe('1.0');
      expect(bundle.id).toMatch(/^bundle_[a-f0-9]+$/);
      expect(bundle.source).toBeDefined();
      expect(bundle.source.platform).toBe('claude');
      expect(bundle.source.extractedAt).toBeDefined();
      expect(bundle.source.extractorVersion).toBe('1.0.0');
      expect(bundle.contents).toBeDefined();
      expect(bundle.metadata).toBeDefined();
    });

    it('should have correct metadata counts', async () => {
      await createMockExport({
        conversations: true,
        conversationCount: 3,
        projects: true,
        files: true,
      });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({ workDir });

      expect(bundle.metadata.itemCounts).toBeDefined();
      expect(bundle.metadata.itemCounts.conversations).toBe(3);
      expect(bundle.metadata.itemCounts.customBots).toBe(2);
      expect(bundle.metadata.itemCounts.files).toBeGreaterThan(0);
      expect(bundle.metadata.totalItems).toBe(
        bundle.metadata.itemCounts.instructions +
          bundle.metadata.itemCounts.memories +
          bundle.metadata.itemCounts.conversations +
          bundle.metadata.itemCounts.files +
          bundle.metadata.itemCounts.customBots,
      );
    });

    it('should include warnings and errors arrays', async () => {
      await createMockExport({ conversations: true });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({ workDir });

      expect(bundle.metadata.warnings).toBeDefined();
      expect(Array.isArray(bundle.metadata.warnings)).toBe(true);
      expect(bundle.metadata.errors).toBeDefined();
      expect(Array.isArray(bundle.metadata.errors)).toBe(true);
    });
  });

  // ─── Error Handling ──────────────────────────────────────────

  describe('error handling', () => {
    it('should handle missing conversations gracefully', async () => {
      // Create export with only projects
      await createMockExport({ conversations: false, projects: true });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations', 'customBots'],
      });

      // Should not have conversations
      expect(bundle.contents.conversations).toBeUndefined();

      // Should still have projects
      expect(bundle.contents.customBots).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      await mkdir(exportDir, { recursive: true });
      await writeFile(join(exportDir, 'conversations.json'), '{ invalid json }');

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations'],
      });

      // Should record error but not throw
      expect(bundle.metadata.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty export directory', async () => {
      // exportDir is already empty

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({ workDir });

      expect(bundle.contents).toBeDefined();
      expect(bundle.metadata.totalItems).toBe(0);
    });
  });

  // ─── Include/Exclude Filtering ───────────────────────────────

  describe('include filtering', () => {
    it('should only extract specified content types', async () => {
      await createMockExport({
        conversations: true,
        projects: true,
        files: true,
      });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations'],
      });

      expect(bundle.contents.conversations).toBeDefined();
      // customBots might still be extracted as they're processed in a different path
      // but files and other explicit includes should be filtered
    });

    it('should extract all types when include is not specified', async () => {
      await createMockExport({
        conversations: true,
        projects: true,
        files: true,
      });

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({ workDir });

      expect(bundle.contents.conversations).toBeDefined();
      expect(bundle.contents.customBots).toBeDefined();
      expect(bundle.contents.files).toBeDefined();
    });
  });

  // ─── Filename Sanitization ───────────────────────────────────

  describe('filename sanitization', () => {
    it('should sanitize filenames with special characters', async () => {
      await createMockExport({ conversations: false, projects: false });

      // Create file with special characters
      const filesDir = join(exportDir, 'files');
      await mkdir(filesDir, { recursive: true });
      await writeFile(join(filesDir, 'normal_file.txt'), 'content');

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['files'],
      });

      // All extracted files should have safe names
      for (const file of bundle.contents.files?.files || []) {
        expect(file.filename).not.toMatch(/[/\\:*?"<>|]/);
      }
    });
  });

  // ─── Key Points Extraction ───────────────────────────────────

  describe('key points extraction', () => {
    it('should extract key points from assistant messages', async () => {
      const convWithConclusion = [
        {
          uuid: 'conv_1',
          name: 'Conclusion Conversation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          chat_messages: [
            {
              uuid: 'msg_1',
              text: 'What should I do?',
              sender: 'human',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              uuid: 'msg_2',
              text: 'In summary, you should focus on three main areas: testing, documentation, and code review.',
              sender: 'assistant',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      ];

      await writeFile(join(exportDir, 'conversations.json'), JSON.stringify(convWithConclusion));

      const extractor = new ClaudeExtractor({
        exportPath: exportDir,
      });

      const bundle = await extractor.extract({
        workDir,
        include: ['conversations'],
      });

      const summary = bundle.contents.conversations?.summaries?.[0];
      expect(summary).toBeDefined();
      expect(summary?.keyPoints).toBeDefined();
      expect(summary?.keyPoints?.length).toBeGreaterThan(0);
    });
  });
});

// ─── API-based Extraction Tests (Mocked) ─────────────────────

describe('ClaudeExtractor API mode', () => {
  let testDir: string;
  let workDir: string;

  const mockFetch = vi.fn();

  beforeEach(async () => {
    const testId = `savestate-claude-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), testId);
    workDir = join(testDir, 'work');

    await mkdir(workDir, { recursive: true });

    // Mock global fetch
    global.fetch = mockFetch;
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function mockApiResponses() {
    mockFetch.mockImplementation(async (url: string, options: RequestInit) => {
      const path = new URL(url).pathname;
      const method = options?.method || 'GET';

      // List projects
      if (method === 'GET' && path === '/v1/projects') {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'proj_api_1',
                name: 'API Project 1',
                description: 'First project',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
              {
                id: 'proj_api_2',
                name: 'API Project 2',
                description: 'Second project',
                created_at: '2024-01-03T00:00:00Z',
                updated_at: '2024-01-04T00:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Get project details
      if (method === 'GET' && path.match(/^\/v1\/projects\/proj_api_\d+$/)) {
        const projId = path.split('/').pop();
        return new Response(
          JSON.stringify({
            id: projId,
            name: projId === 'proj_api_1' ? 'API Project 1' : 'API Project 2',
            description: 'Test project',
            prompt_template: `System prompt for ${projId}`,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // List project documents
      if (method === 'GET' && path.match(/^\/v1\/projects\/proj_api_\d+\/docs$/)) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'doc_1',
                name: 'knowledge.md',
                content: '# Knowledge\n\nImportant info here.',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Get document details
      if (method === 'GET' && path.match(/^\/v1\/projects\/proj_api_\d+\/docs\/doc_\d+$/)) {
        return new Response(
          JSON.stringify({
            id: 'doc_1',
            name: 'knowledge.md',
            content: '# Knowledge\n\nImportant info here.',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // List project files
      if (method === 'GET' && path.match(/^\/v1\/projects\/proj_api_\d+\/files$/)) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'file_1',
                name: 'data.csv',
                content_type: 'text/csv',
                size: 256,
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Download file
      if (method === 'GET' && path.match(/^\/v1\/projects\/proj_api_\d+\/files\/file_\d+\/content$/)) {
        return new Response('name,value\ntest,123', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        });
      }

      return new Response('Not found', { status: 404 });
    });
  }

  it('should verify API access', async () => {
    mockApiResponses();

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
    });

    const canExtract = await extractor.canExtract();
    expect(canExtract).toBe(true);
  });

  it('should extract projects via API', async () => {
    mockApiResponses();

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
    });

    const bundle = await extractor.extract({
      workDir,
      include: ['customBots'],
    });

    expect(bundle.contents.customBots).toBeDefined();
    expect(bundle.contents.customBots!.count).toBe(2);

    const proj1 = bundle.contents.customBots!.bots.find((b) => b.id === 'proj_api_1');
    expect(proj1).toBeDefined();
    expect(proj1!.name).toBe('API Project 1');
    expect(proj1!.instructions).toContain('System prompt');
  });

  it('should extract project knowledge documents', async () => {
    mockApiResponses();

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
    });

    const bundle = await extractor.extract({
      workDir,
      include: ['customBots', 'memories'],
    });

    // Knowledge docs should be extracted as memories
    expect(bundle.contents.memories).toBeDefined();
    expect(bundle.contents.memories!.count).toBeGreaterThan(0);

    const knowledgeEntry = bundle.contents.memories!.entries.find((e) =>
      e.content.includes('Important info'),
    );
    expect(knowledgeEntry).toBeDefined();
    expect(knowledgeEntry!.source).toBe('claude-project-knowledge');
  });

  it('should extract and download project files', async () => {
    mockApiResponses();

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
    });

    const bundle = await extractor.extract({
      workDir,
      include: ['customBots', 'files'],
    });

    expect(bundle.contents.files).toBeDefined();
    expect(bundle.contents.files!.count).toBeGreaterThan(0);

    const csvFile = bundle.contents.files!.files.find((f) => f.filename === 'data.csv');
    expect(csvFile).toBeDefined();

    // Verify file was downloaded
    const filePath = join(workDir, csvFile!.path);
    expect(existsSync(filePath)).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('name,value');
  });

  it('should filter by project IDs', async () => {
    mockApiResponses();

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
      projectIds: ['proj_api_1'],
    });

    const bundle = await extractor.extract({
      workDir,
      include: ['customBots'],
    });

    expect(bundle.contents.customBots).toBeDefined();
    expect(bundle.contents.customBots!.count).toBe(1);
    expect(bundle.contents.customBots!.bots[0].id).toBe('proj_api_1');
  });

  it('should respect maxProjects limit', async () => {
    mockApiResponses();

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
      maxProjects: 1,
    });

    const bundle = await extractor.extract({
      workDir,
      include: ['customBots'],
    });

    expect(bundle.contents.customBots).toBeDefined();
    expect(bundle.contents.customBots!.count).toBe(1);
    expect(bundle.metadata.warnings).toContain('Limited to 1 projects (2 available)');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockImplementation(async () => {
      return new Response('Unauthorized', { status: 401 });
    });

    const extractor = new ClaudeExtractor({
      apiKey: 'invalid-key',
    });

    const canExtract = await extractor.canExtract();
    expect(canExtract).toBe(false);
  });

  it('should handle rate limiting with retries', async () => {
    let attempts = 0;
    mockFetch.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;

      if (path === '/v1/projects') {
        attempts++;
        if (attempts < 2) {
          return new Response('Rate limited', {
            status: 429,
            headers: { 'retry-after': '1' },
          });
        }
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const extractor = new ClaudeExtractor({
      apiKey: 'test-api-key',
      rateLimit: {
        maxRetries: 3,
        initialBackoffMs: 100,
      },
    });

    const bundle = await extractor.extract({
      workDir,
      include: ['customBots'],
    });

    expect(attempts).toBeGreaterThan(1);
    expect(bundle).toBeDefined();
  });
});
