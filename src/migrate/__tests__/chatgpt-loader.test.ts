/**
 * ChatGPT Loader Tests
 *
 * Tests for the ChatGPT loader implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChatGPTLoader, type ChatGPTLoaderConfig } from '../loaders/chatgpt.js';
import type { MigrationBundle, MemoryEntry, FileEntry, CustomBotEntry } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ChatGPTLoader', () => {
  let testWorkDir: string;
  let loader: ChatGPTLoader;

  // Helper to create a test bundle
  function createTestBundle(overrides: Partial<MigrationBundle> = {}): MigrationBundle {
    return {
      version: '1.0',
      id: 'test-bundle-123',
      source: {
        platform: 'claude',
        extractedAt: '2026-02-10T10:00:00Z',
        extractorVersion: '1.0.0',
      },
      target: {
        platform: 'chatgpt',
        transformedAt: '2026-02-10T11:00:00Z',
        transformerVersion: '1.0.0',
      },
      contents: {
        instructions: {
          content: 'You are a helpful assistant. Be concise and accurate.',
          length: 49,
        },
        memories: {
          entries: [
            { id: 'm1', content: 'User prefers dark mode', createdAt: '2026-01-01T00:00:00Z', category: 'Preferences' },
            { id: 'm2', content: 'User works in tech industry', createdAt: '2026-01-02T00:00:00Z', category: 'Work' },
            { id: 'm3', content: 'User likes TypeScript', createdAt: '2026-01-03T00:00:00Z', category: 'Preferences' },
          ],
          count: 3,
        },
        ...overrides.contents,
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
        ...overrides.metadata,
      },
      ...overrides,
    };
  }

  // Helper to mock successful API responses
  function mockApiSuccess() {
    mockFetch.mockImplementation(async (url: string, options: RequestInit) => {
      const path = new URL(url).pathname;
      const method = options.method || 'GET';

      // List files
      if (method === 'GET' && path === '/v1/files') {
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Upload file
      if (method === 'POST' && path === '/v1/files') {
        return new Response(
          JSON.stringify({
            id: `file_${Date.now()}`,
            object: 'file',
            bytes: 100,
            created_at: Math.floor(Date.now() / 1000),
            filename: 'test.txt',
            purpose: 'assistants',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Delete file
      if (method === 'DELETE' && path.match(/\/v1\/files\/[^/]+$/)) {
        return new Response(JSON.stringify({ deleted: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 });
    });
  }

  beforeEach(async () => {
    testWorkDir = join(tmpdir(), `chatgpt-loader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testWorkDir, { recursive: true });

    mockFetch.mockReset();

    loader = new ChatGPTLoader({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.openai.com/v1',
      outputDir: testWorkDir,
    });
  });

  afterEach(async () => {
    if (existsSync(testWorkDir)) {
      await rm(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('canLoad', () => {
    it('should return true even without API key (generates guidance files)', async () => {
      const loaderNoKey = new ChatGPTLoader({ apiKey: '' });
      const result = await loaderNoKey.canLoad();
      expect(result).toBe(true);
    });

    it('should return true with API key', async () => {
      const result = await loader.canLoad();
      expect(result).toBe(true);
    });
  });

  describe('load - success cases', () => {
    it('should create migration output directory with all components', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.instructions).toBe(true);
      expect(result.loaded.memories).toBe(3);
      expect(result.created?.projectId).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should generate custom instructions file', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      await loader.load(bundle, {});

      const instructionsPath = join(testWorkDir, 'custom-instructions.txt');
      expect(existsSync(instructionsPath)).toBe(true);

      const content = await readFile(instructionsPath, 'utf-8');
      expect(content).toBe(bundle.contents.instructions?.content);
    });

    it('should generate memories file with formatted content', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      await loader.load(bundle, {});

      const memoriesPath = join(testWorkDir, 'memories.md');
      expect(existsSync(memoriesPath)).toBe(true);

      const content = await readFile(memoriesPath, 'utf-8');
      expect(content).toContain('ChatGPT Memories to Add');
      expect(content).toContain('User prefers dark mode');
      expect(content).toContain('User works in tech industry');
    });

    it('should handle bundle without instructions', async () => {
      mockApiSuccess();
      const bundle = createTestBundle({
        contents: {
          memories: {
            entries: [{ id: 'm1', content: 'Test memory', createdAt: '2026-01-01T00:00:00Z' }],
            count: 1,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.instructions).toBe(false);
      expect(result.loaded.memories).toBe(1);
    });

    it('should handle bundle without memories', async () => {
      mockApiSuccess();
      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'Test instructions', length: 17 },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.instructions).toBe(true);
      expect(result.loaded.memories).toBe(0);
    });

    it('should track progress during load', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();
      const progressUpdates: Array<{ progress: number; message: string }> = [];

      await loader.load(bundle, {
        onProgress: (progress, message) => {
          progressUpdates.push({ progress, message });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Progress should increase monotonically
      let lastProgress = 0;
      for (const update of progressUpdates) {
        expect(update.progress).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = update.progress;
      }

      // Should reach 100%
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(1.0);
    });

    it('should provide manual steps in result', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      const result = await loader.load(bundle, {});

      expect(result.manualSteps).toBeDefined();
      expect(result.manualSteps!.length).toBeGreaterThan(0);
      expect(result.manualSteps!.some(s => s.includes('Custom Instructions'))).toBe(true);
      expect(result.manualSteps!.some(s => s.includes('memories'))).toBe(true);
    });
  });

  describe('load - file uploads', () => {
    it('should upload files to OpenAI when API key is provided', async () => {
      mockApiSuccess();

      // Create a test file
      const testFilePath = join(testWorkDir, 'test-document.txt');
      await writeFile(testFilePath, 'Hello, this is test content');

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir, // Required for path validation
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'test-document.txt',
                mimeType: 'text/plain',
                size: 27,
                path: 'test-document.txt', // Relative path within bundle
              },
            ],
            count: 1,
            totalSize: 27,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(1);

      // Verify file upload was called
      const fileCalls = mockFetch.mock.calls.filter(
        (call) => {
          const [url] = call as [string, RequestInit];
          return url.includes('/files');
        },
      );
      expect(fileCalls.length).toBe(1);
    });

    it('should skip files exceeding size limit', async () => {
      mockApiSuccess();

      const testFilePath = join(testWorkDir, 'large-file.txt');
      await writeFile(testFilePath, 'x'.repeat(100));

      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'large-file.txt',
                mimeType: 'text/plain',
                size: 600 * 1024 * 1024, // 600MB (exceeds 512MB limit)
                path: testFilePath,
              },
            ],
            count: 1,
            totalSize: 600 * 1024 * 1024,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('exceeds size limit'));
    });

    it('should warn about missing files within bundle directory', async () => {
      mockApiSuccess();

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir,
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'missing-file.txt',
                mimeType: 'text/plain',
                size: 100,
                path: 'missing-file.txt', // File doesn't exist but path is valid
              },
            ],
            count: 1,
            totalSize: 100,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('not found'));
    });

    it('should reject files with absolute paths outside bundle (path traversal)', async () => {
      mockApiSuccess();

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir,
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'passwd',
                mimeType: 'text/plain',
                size: 100,
                path: '/etc/passwd', // Absolute path outside bundle
              },
            ],
            count: 1,
            totalSize: 100,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('Invalid file path'));
    });

    it('should generate file manifest when no API key provided', async () => {
      const loaderNoKey = new ChatGPTLoader({
        apiKey: '',
        outputDir: testWorkDir,
      });

      const testFilePath = join(testWorkDir, 'test-file.txt');
      await writeFile(testFilePath, 'Hello world');

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir, // Required for path validation
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'test-file.txt',
                mimeType: 'text/plain',
                size: 11,
                path: 'test-file.txt', // Relative path within bundle
              },
            ],
            count: 1,
            totalSize: 11,
          },
        },
      });

      const result = await loaderNoKey.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(0); // No files uploaded without API key
      expect(result.warnings).toContainEqual(expect.stringContaining('No API key'));

      const manifestPath = join(testWorkDir, 'files-manifest.md');
      expect(existsSync(manifestPath)).toBe(true);

      const content = await readFile(manifestPath, 'utf-8');
      expect(content).toContain('test-file.txt');
    });
  });

  describe('load - dry run', () => {
    it('should not create any files in dry run mode', async () => {
      const bundle = createTestBundle();

      const result = await loader.load(bundle, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dry run - no changes made');
      expect(mockFetch).not.toHaveBeenCalled();

      // Should not create output files
      const instructionsPath = join(testWorkDir, 'custom-instructions.txt');
      expect(existsSync(instructionsPath)).toBe(false);
    });

    it('should report potential issues in dry run', async () => {
      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'x'.repeat(2000), length: 2000 }, // Exceeds 1500 char limit
        },
      });

      const result = await loader.load(bundle, { dryRun: true });

      expect(result.warnings).toContainEqual(expect.stringContaining('would be truncated'));
    });

    it('should report memory limit issues in dry run', async () => {
      const entries: MemoryEntry[] = Array.from({ length: 150 }, (_, i) => ({
        id: `m${i}`,
        content: `Memory ${i}`,
        createdAt: '2026-01-01T00:00:00Z',
      }));

      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'Test', length: 4 },
          memories: {
            entries,
            count: 150,
          },
        },
      });

      const result = await loader.load(bundle, { dryRun: true });

      expect(result.warnings).toContainEqual(expect.stringContaining('would be truncated'));
      expect(result.warnings).toContainEqual(expect.stringContaining('150 > 100'));
    });
  });

  describe('load - error handling', () => {
    it('should handle API errors gracefully for file upload', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
        }),
      );

      const testFilePath = join(testWorkDir, 'test.txt');
      await writeFile(testFilePath, 'Hello');

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir, // Required for path validation
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'test.txt',
                mimeType: 'text/plain',
                size: 5,
                path: 'test.txt', // Relative path within bundle
              },
            ],
            count: 1,
            totalSize: 5,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true); // Overall success (instructions/memories still work)
      expect(result.loaded.files).toBe(0);
      expect(result.errors).toContainEqual(expect.stringContaining('Failed to upload'));
    });

    it('should retry on rate limit errors', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        // Only count and handle file upload requests
        if (url.includes('/files')) {
          callCount++;
          // First 2 calls return 429, third succeeds
          if (callCount <= 2) {
            return new Response(JSON.stringify({ error: { message: 'Rate limited' } }), {
              status: 429,
              headers: { 'retry-after': '0' }, // Immediate retry for test
            });
          }
          return new Response(
            JSON.stringify({
              id: `file_success_${Date.now()}`,
              object: 'file',
              bytes: 5,
              created_at: Math.floor(Date.now() / 1000),
              filename: 'test.txt',
              purpose: 'assistants',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const testFilePath = join(testWorkDir, 'test.txt');
      await writeFile(testFilePath, 'Hello');

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir, // Required for path validation
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'test.txt',
                mimeType: 'text/plain',
                size: 5,
                path: 'test.txt', // Relative path within bundle
              },
            ],
            count: 1,
            totalSize: 5,
          },
        },
      });

      const loaderWithRetry = new ChatGPTLoader({
        apiKey: 'test-key',
        retryDelayMs: 10,
        maxRetries: 5, // Allow more retries
        outputDir: testWorkDir,
      });

      const result = await loaderWithRetry.load(bundle, {});

      // Verify retries happened - we should have at least 3 calls (2 failures + 1 success)
      expect(callCount).toBeGreaterThanOrEqual(3);
      
      // After retries, the upload should succeed
      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(1);
    });
  });

  describe('load - bundle validation', () => {
    it('should reject bundles not transformed for ChatGPT', async () => {
      const bundle = createTestBundle({
        target: {
          platform: 'claude',
          transformedAt: '2026-02-10T11:00:00Z',
          transformerVersion: '1.0.0',
        },
      });

      await expect(loader.load(bundle, {})).rejects.toThrow('not transformed for ChatGPT');
    });
  });

  describe('load - custom GPTs handling', () => {
    it('should generate GPT configuration guides', async () => {
      mockApiSuccess();

      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'Test', length: 4 },
          customBots: {
            bots: [
              {
                id: 'gpt1',
                name: 'My Custom GPT',
                description: 'A helpful assistant',
                instructions: 'Be helpful and concise',
                capabilities: ['Web browsing', 'Code interpreter'],
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
            count: 1,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.customBots).toBe(0); // Always 0 - requires manual creation
      expect(result.warnings).toContainEqual(expect.stringContaining('GPT configurations exported'));

      // Check GPT guide was created
      const gptFile = join(testWorkDir, 'gpts', 'my_custom_gpt.md');
      expect(existsSync(gptFile)).toBe(true);

      const content = await readFile(gptFile, 'utf-8');
      expect(content).toContain('My Custom GPT');
      expect(content).toContain('Be helpful and concise');
      expect(content).toContain('Web browsing');
    });
  });

  describe('load state management', () => {
    it('should track and expose load state for checkpointing', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      await loader.load(bundle, {});

      const state = loader.getLoadState();

      expect(state.instructionsProcessed).toBe(true);
      expect(state.memoriesProcessed).toBe(true);
      expect(state.outputDir).toBeDefined();
    });

    it('should allow setting load state for resume', async () => {
      const previousState = {
        instructionsProcessed: true,
        memoriesProcessed: true,
        uploadedFileIds: ['file_1', 'file_2'],
        uploadedFilenames: ['a.txt', 'b.txt'],
        lastFileIndex: 1,
        outputDir: '/test/path',
      };

      loader.setLoadState(previousState);
      const state = loader.getLoadState();

      expect(state.instructionsProcessed).toBe(true);
      expect(state.uploadedFileIds).toEqual(['file_1', 'file_2']);
      expect(state.lastFileIndex).toBe(1);
    });
  });

  describe('getProgress', () => {
    it('should return current progress', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      // Before load
      expect(loader.getProgress()).toBe(0);

      await loader.load(bundle, {});

      // After load
      expect(loader.getProgress()).toBe(100);
    });
  });

  describe('security - path traversal prevention', () => {
    it('should reject file paths with path traversal attempts', async () => {
      mockApiSuccess();

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir,
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'secret.txt',
                mimeType: 'text/plain',
                size: 100,
                path: '../../../etc/passwd', // Path traversal attempt
              },
            ],
            count: 1,
            totalSize: 100,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('Invalid file path'));
    });

    it('should reject absolute paths outside bundle directory', async () => {
      mockApiSuccess();

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir,
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'secret.txt',
                mimeType: 'text/plain',
                size: 100,
                path: '/etc/passwd', // Absolute path outside bundle
              },
            ],
            count: 1,
            totalSize: 100,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('Invalid file path'));
    });

    it('should accept valid file paths within bundle directory', async () => {
      mockApiSuccess();

      // Create a test file inside the work directory
      const testFilePath = join(testWorkDir, 'valid-file.txt');
      await writeFile(testFilePath, 'Valid file content');

      const bundle = createTestBundle({
        source: {
          platform: 'claude',
          extractedAt: '2026-02-10T10:00:00Z',
          extractorVersion: '1.0.0',
          bundlePath: testWorkDir,
        },
        contents: {
          instructions: { content: 'Test', length: 4 },
          files: {
            files: [
              {
                id: 'f1',
                filename: 'valid-file.txt',
                mimeType: 'text/plain',
                size: 18,
                path: 'valid-file.txt', // Relative path within bundle
              },
            ],
            count: 1,
            totalSize: 18,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.files).toBe(1);
    });
  });

  describe('security - output directory sanitization', () => {
    it('should sanitize output directory with path traversal in projectName', async () => {
      mockApiSuccess();

      // No outputDir in config - tests projectName sanitization
      const loaderCustom = new ChatGPTLoader({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const bundle = createTestBundle();

      const result = await loaderCustom.load(bundle, {
        projectName: '../../../tmp/evil-directory', // Path traversal attempt
      });

      expect(result.success).toBe(true);
      // The output directory should be sanitized to just the basename
      expect(result.created?.projectId).toBe('evil-directory');
      expect(result.created?.projectId).not.toContain('..');
    });

    it('should sanitize output directory with absolute path in projectName', async () => {
      mockApiSuccess();

      // No outputDir in config - tests projectName sanitization
      const loaderCustom = new ChatGPTLoader({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const bundle = createTestBundle();

      const result = await loaderCustom.load(bundle, {
        projectName: '/tmp/absolute-path-attempt', // Absolute path attempt
      });

      expect(result.success).toBe(true);
      // The output directory should be sanitized to just the basename
      expect(result.created?.projectId).toBe('absolute-path-attempt');
      expect(result.created?.projectId).not.toContain('/tmp');
    });

    it('should fallback to default name when projectName is empty after sanitization', async () => {
      mockApiSuccess();

      // No outputDir in config - tests projectName sanitization
      const loaderCustom = new ChatGPTLoader({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const bundle = createTestBundle();

      const result = await loaderCustom.load(bundle, {
        projectName: '/', // Edge case: just a slash
      });

      expect(result.success).toBe(true);
      expect(result.created?.projectId).toBe('chatgpt-migration');
    });

    it('should respect config.outputDir when set (trusted developer input)', async () => {
      mockApiSuccess();

      // When outputDir is configured, it should be used as-is (trusted)
      const loaderWithConfig = new ChatGPTLoader({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
        outputDir: testWorkDir, // Developer-configured path
      });

      const bundle = createTestBundle();

      const result = await loaderWithConfig.load(bundle, {
        projectName: '../../../should-be-ignored', // Should be ignored
      });

      expect(result.success).toBe(true);
      expect(result.created?.projectId).toBe(testWorkDir);
    });
  });

  describe('instructions truncation', () => {
    it('should truncate instructions exceeding limit and warn', async () => {
      mockApiSuccess();

      const longInstructions = 'x'.repeat(2000); // Exceeds 1500 char limit
      const bundle = createTestBundle({
        contents: {
          instructions: { content: longInstructions, length: 2000 },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('truncated'));

      // Verify truncated content was written
      const instructionsPath = join(testWorkDir, 'custom-instructions.txt');
      const content = await readFile(instructionsPath, 'utf-8');
      expect(content.length).toBeLessThanOrEqual(1500);

      // Full content should also be saved
      const fullPath = join(testWorkDir, 'custom-instructions-full.txt');
      expect(existsSync(fullPath)).toBe(true);
    });

    it('should use intelligent truncation', async () => {
      mockApiSuccess();

      // Create content with examples that will exceed the 1500 char limit
      const contentWithExamples = `
You are a helpful assistant.

Example: This is a long example that should be removed.
\`\`\`
function example() {
  console.log('This is code that might be removed');
}
\`\`\`

Be concise and accurate.

Note: This is a verbose note that might be removed.

Always respond in a professional manner.

Here are some guidelines:
- Be helpful and informative
- Answer questions accurately
- Stay on topic
- Be respectful and professional
`.repeat(10); // Repeat 10x to definitely exceed 1500 char limit

      expect(contentWithExamples.length).toBeGreaterThan(1500); // Verify it exceeds limit

      const bundle = createTestBundle({
        contents: {
          instructions: { content: contentWithExamples, length: contentWithExamples.length },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('truncated'));
    });
  });

  describe('memories processing', () => {
    it('should group memories by category', async () => {
      mockApiSuccess();

      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'Test', length: 4 },
          memories: {
            entries: [
              { id: 'm1', content: 'Memory 1', createdAt: '2026-01-01T00:00:00Z', category: 'Work' },
              { id: 'm2', content: 'Memory 2', createdAt: '2026-01-02T00:00:00Z', category: 'Preferences' },
              { id: 'm3', content: 'Memory 3', createdAt: '2026-01-03T00:00:00Z', category: 'Work' },
            ],
            count: 3,
          },
        },
      });

      await loader.load(bundle, {});

      const memoriesPath = join(testWorkDir, 'memories.md');
      const content = await readFile(memoriesPath, 'utf-8');

      expect(content).toContain('## Work');
      expect(content).toContain('## Preferences');
      expect(content).toContain('- Memory 1');
      expect(content).toContain('- Memory 2');
      expect(content).toContain('- Memory 3');
    });

    it('should truncate memories exceeding limit', async () => {
      mockApiSuccess();

      const entries: MemoryEntry[] = Array.from({ length: 150 }, (_, i) => ({
        id: `m${i}`,
        content: `Memory ${i}`,
        createdAt: '2026-01-01T00:00:00Z',
      }));

      const bundle = createTestBundle({
        contents: {
          instructions: { content: 'Test', length: 4 },
          memories: {
            entries,
            count: 150,
          },
        },
      });

      const result = await loader.load(bundle, {});

      expect(result.success).toBe(true);
      expect(result.loaded.memories).toBe(100); // Truncated to limit
      expect(result.warnings).toContainEqual(expect.stringContaining('Memories truncated'));
    });

    it('should also write memories as JSON', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      await loader.load(bundle, {});

      const jsonPath = join(testWorkDir, 'memories.json');
      expect(existsSync(jsonPath)).toBe(true);

      const content = await readFile(jsonPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed.length).toBe(3);
    });
  });

  describe('README generation', () => {
    it('should generate README with migration summary', async () => {
      mockApiSuccess();
      const bundle = createTestBundle();

      await loader.load(bundle, {});

      const readmePath = join(testWorkDir, 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const content = await readFile(readmePath, 'utf-8');
      expect(content).toContain('ChatGPT Migration Package');
      expect(content).toContain('Custom Instructions');
      expect(content).toContain('Memories');
      expect(content).toContain('Manual Steps Required');
    });
  });
});
