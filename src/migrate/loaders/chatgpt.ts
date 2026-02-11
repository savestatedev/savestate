/**
 * ChatGPT Loader
 *
 * Loads migration data into ChatGPT.
 *
 * Target Structure:
 * - Custom Instructions (from transformed system prompt, max 1500 chars)
 * - Memories (from project knowledge, max 100 entries)
 * - Uploaded Files (via Files API)
 *
 * NOTE: ChatGPT has limited public API support. Some operations require manual steps:
 * - Custom Instructions: Not settable via API, loader provides guidance
 * - Memories: Not settable via API, loader provides formatted content to add manually
 * - Files: Can be uploaded via OpenAI Files API for use with Assistants
 * - Custom GPTs: Require manual creation through ChatGPT interface
 *
 * @see https://platform.openai.com/docs/api-reference/files
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve, relative } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type {
  Platform,
  Loader,
  LoadOptions,
  LoadResult,
  MigrationBundle,
  FileEntry,
  MemoryEntry,
} from '../types.js';
import { getPlatformCapabilities } from '../capabilities.js';
import { intelligentTruncate } from '../transformers/rules.js';

// ─── API Types ───────────────────────────────────────────────

interface OpenAIFile {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
  retryAfter?: number;
}

// ─── Configuration ───────────────────────────────────────────

export interface ChatGPTLoaderConfig {
  /** OpenAI API key (for file uploads) */
  apiKey?: string;
  /** API base URL (defaults to https://api.openai.com/v1) */
  baseUrl?: string;
  /** Max retries for failed requests */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  retryDelayMs?: number;
  /** Organization ID (if applicable) */
  organizationId?: string;
  /** Output directory for manual step files */
  outputDir?: string;
}

// ─── Rate Limiter ────────────────────────────────────────────

class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 60, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((t) => now - t < this.windowMs);

    if (this.requestTimes.length >= this.maxRequests) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100;
      await this.sleep(waitTime);
    }

    this.requestTimes.push(Date.now());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── OpenAI API Client ───────────────────────────────────────

class OpenAIApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly rateLimiter: RateLimiter;
  private readonly organizationId?: string;

  constructor(config: ChatGPTLoaderConfig) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.rateLimiter = new RateLimiter();
    this.organizationId = config.organizationId;
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryCount = 0,
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }

    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = new Error() as ApiError;
        error.status = response.status;

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          error.retryAfter = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.retryDelayMs;
          error.code = 'rate_limit_exceeded';
          error.message = 'Rate limit exceeded';

          if (retryCount < this.maxRetries) {
            await this.sleep(error.retryAfter);
            return this.request<T>(method, path, body, retryCount + 1);
          }
        }

        // Handle transient errors
        if (response.status >= 500 && retryCount < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, retryCount));
          return this.request<T>(method, path, body, retryCount + 1);
        }

        try {
          const errorBody = (await response.json()) as { error?: { message?: string; type?: string } };
          error.message = errorBody.error?.message || `API error: ${response.status}`;
          error.code = errorBody.error?.type;
        } catch {
          error.message = `API error: ${response.status} ${response.statusText}`;
        }

        throw error;
      }

      return response.json() as Promise<T>;
    } catch (err) {
      // Retry on network errors
      if (
        err instanceof TypeError &&
        err.message.includes('fetch') &&
        retryCount < this.maxRetries
      ) {
        await this.sleep(this.retryDelayMs * Math.pow(2, retryCount));
        return this.request<T>(method, path, body, retryCount + 1);
      }
      throw err;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Files API ───────────────────────────────────────────

  async uploadFile(
    filename: string,
    content: Buffer,
    purpose: 'assistants' | 'fine-tune' = 'assistants',
    retryCount = 0,
  ): Promise<OpenAIFile> {
    await this.rateLimiter.acquire();

    const formData = new FormData();
    formData.append('file', new Blob([content]), filename);
    formData.append('purpose', purpose);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }

    try {
      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = new Error() as ApiError;
        error.status = response.status;

        // Handle rate limiting
        if (response.status === 429 && retryCount < this.maxRetries) {
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.retryDelayMs;
          await this.sleep(waitTime);
          return this.uploadFile(filename, content, purpose, retryCount + 1);
        }

        // Handle transient errors
        if (response.status >= 500 && retryCount < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, retryCount));
          return this.uploadFile(filename, content, purpose, retryCount + 1);
        }

        try {
          const errorBody = (await response.json()) as { error?: { message?: string } };
          error.message = errorBody.error?.message || `File upload error: ${response.status}`;
        } catch {
          error.message = `File upload error: ${response.status}`;
        }

        throw error;
      }

      return response.json() as Promise<OpenAIFile>;
    } catch (err) {
      // Retry on network errors
      if (
        err instanceof TypeError &&
        err.message.includes('fetch') &&
        retryCount < this.maxRetries
      ) {
        await this.sleep(this.retryDelayMs * Math.pow(2, retryCount));
        return this.uploadFile(filename, content, purpose, retryCount + 1);
      }
      throw err;
    }
  }

  async listFiles(): Promise<OpenAIFile[]> {
    const response = await this.request<{ data: OpenAIFile[] }>('GET', '/files');
    return response.data;
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.request('DELETE', `/files/${fileId}`);
  }
}

// ─── Load State (for resume capability) ──────────────────────

interface ChatGPTLoadState {
  instructionsProcessed: boolean;
  memoriesProcessed: boolean;
  uploadedFileIds: string[];
  uploadedFilenames: string[];
  lastFileIndex: number;
  outputDir?: string;
}

// ─── ChatGPT Loader ──────────────────────────────────────────

export class ChatGPTLoader implements Loader {
  readonly platform: Platform = 'chatgpt';
  readonly version = '1.0.0';

  private progress = 0;
  private config: ChatGPTLoaderConfig;
  private client: OpenAIApiClient;
  private state: ChatGPTLoadState = {
    instructionsProcessed: false,
    memoriesProcessed: false,
    uploadedFileIds: [],
    uploadedFilenames: [],
    lastFileIndex: -1,
  };

  constructor(config: ChatGPTLoaderConfig = {}) {
    this.config = config;
    this.client = new OpenAIApiClient(config);
  }

  async canLoad(): Promise<boolean> {
    // We can always generate guidance files even without API key
    // API key only needed for file uploads
    return true;
  }

  async load(bundle: MigrationBundle, options: LoadOptions): Promise<LoadResult> {
    this.progress = 0;
    const warnings: string[] = [];
    const errors: string[] = [];
    const manualSteps: string[] = [];
    const capabilities = getPlatformCapabilities('chatgpt');

    // Validate bundle target
    if (bundle.target?.platform !== 'chatgpt') {
      throw new Error('Bundle not transformed for ChatGPT');
    }

    // Check for dry run
    if (options.dryRun) {
      return this.dryRunResult(bundle, warnings);
    }

    // Setup output directory for guidance files
    // config.outputDir is trusted (set by developer), but projectName may be user-controlled
    // Sanitize projectName with basename to prevent path injection
    let outputDir: string;
    if (this.config.outputDir) {
      outputDir = this.config.outputDir;
    } else if (options.projectName) {
      outputDir = basename(options.projectName) || 'chatgpt-migration';
    } else {
      outputDir = `chatgpt-migration-${new Date().toISOString().split('T')[0]}`;
    }
    this.state.outputDir = outputDir;

    try {
      await mkdir(outputDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    let instructionsLoaded = false;
    let memoriesLoaded = 0;
    let filesLoaded = 0;

    try {
      // Step 1: Process Custom Instructions (20%)
      options.onProgress?.(0.05, 'Processing custom instructions...');
      if (bundle.contents.instructions?.content) {
        const result = await this.processInstructions(
          bundle.contents.instructions.content,
          capabilities.instructionLimit,
          outputDir,
        );
        instructionsLoaded = result.success;
        if (result.warning) warnings.push(result.warning);
        if (result.manualStep) manualSteps.push(result.manualStep);
      }
      this.progress = 20;
      options.onProgress?.(0.2, 'Instructions processed');

      // Step 2: Process Memories (40%)
      options.onProgress?.(0.25, 'Processing memories...');
      if (bundle.contents.memories?.entries && bundle.contents.memories.entries.length > 0) {
        const result = await this.processMemories(
          bundle.contents.memories.entries,
          capabilities.memoryLimit!,
          outputDir,
        );
        memoriesLoaded = result.count;
        if (result.warnings.length > 0) warnings.push(...result.warnings);
        if (result.manualStep) manualSteps.push(result.manualStep);
      }
      this.progress = 40;
      options.onProgress?.(0.4, 'Memories processed');

      // Step 3: Upload Files (40-85%)
      if (bundle.contents.files?.files && bundle.contents.files.files.length > 0) {
        if (this.client.hasApiKey()) {
          const files = bundle.contents.files.files;
          const startIndex = this.state.lastFileIndex + 1;

          for (let i = startIndex; i < files.length; i++) {
            const file = files[i];
            const fileProgress = 0.4 + (0.45 * (i + 1)) / files.length;
            options.onProgress?.(fileProgress, `Uploading file ${i + 1}/${files.length}: ${file.filename}`);

            try {
              const uploadResult = await this.uploadFile(file, bundle, capabilities.fileSizeLimit!);
              if (uploadResult.success) {
                this.state.uploadedFileIds.push(uploadResult.fileId!);
                this.state.uploadedFilenames.push(file.filename);
                this.state.lastFileIndex = i;
                filesLoaded++;
              } else if (uploadResult.warning) {
                warnings.push(uploadResult.warning);
              }
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              errors.push(`Failed to upload ${file.filename}: ${errorMsg}`);
            }
          }
        } else {
          // No API key - provide guidance for manual upload
          const result = await this.generateFileManifest(
            bundle.contents.files.files,
            outputDir,
          );
          warnings.push(result.warning);
          if (result.manualStep) manualSteps.push(result.manualStep);
        }
      }
      this.progress = 85;
      options.onProgress?.(0.85, 'Files processed');

      // Step 4: Handle Custom GPTs (100%)
      if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
        options.onProgress?.(0.9, 'Generating GPT configuration guides...');
        const result = await this.generateGPTGuides(
          bundle.contents.customBots.bots,
          outputDir,
        );
        if (result.warning) warnings.push(result.warning);
        if (result.manualStep) manualSteps.push(result.manualStep);
      }
      this.progress = 100;
      options.onProgress?.(1.0, 'Migration complete');

      // Generate summary README
      await this.generateReadme(outputDir, {
        instructionsLoaded,
        memoriesLoaded,
        filesLoaded,
        hasApiKey: this.client.hasApiKey(),
        totalFiles: bundle.contents.files?.count ?? 0,
        hasGPTs: (bundle.contents.customBots?.count ?? 0) > 0,
      });

      return {
        success: true,
        loaded: {
          instructions: instructionsLoaded,
          memories: memoriesLoaded,
          files: filesLoaded,
          customBots: 0, // Always requires manual creation
        },
        created: {
          projectId: outputDir,
          projectUrl: `file://${outputDir}`,
        },
        warnings,
        errors,
        manualSteps: manualSteps.length > 0 ? manualSteps : undefined,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Load failed: ${errorMsg}`);

      return {
        success: false,
        loaded: {
          instructions: this.state.instructionsProcessed,
          memories: this.state.memoriesProcessed ? memoriesLoaded : 0,
          files: this.state.uploadedFileIds.length,
          customBots: 0,
        },
        created: this.state.outputDir
          ? {
              projectId: this.state.outputDir,
              projectUrl: `file://${this.state.outputDir}`,
            }
          : undefined,
        warnings,
        errors,
      };
    }
  }

  getProgress(): number {
    return this.progress;
  }

  /**
   * Get current load state for checkpointing.
   */
  getLoadState(): ChatGPTLoadState {
    return { ...this.state };
  }

  /**
   * Set load state for resume.
   */
  setLoadState(state: ChatGPTLoadState): void {
    this.state = { ...state };
  }

  // ─── Private Helpers ─────────────────────────────────────

  private async processInstructions(
    content: string,
    limit: number,
    outputDir: string,
  ): Promise<{ success: boolean; warning?: string; manualStep?: string }> {
    let processedContent = content;
    let warning: string | undefined;

    // Truncate if exceeds limit
    if (content.length > limit) {
      const result = intelligentTruncate(content, limit);
      processedContent = result.content || content.substring(0, limit);
      warning = `Instructions truncated: ${content.length} → ${processedContent.length} chars`;
    }

    // Write instruction file for manual copy
    const instructionFile = join(outputDir, 'custom-instructions.txt');
    await writeFile(instructionFile, processedContent);

    // Also write the full content if truncated
    if (content.length > limit) {
      const fullFile = join(outputDir, 'custom-instructions-full.txt');
      await writeFile(fullFile, content);
    }

    this.state.instructionsProcessed = true;

    return {
      success: true,
      warning,
      manualStep: `Copy custom instructions from "${instructionFile}" to ChatGPT Settings → Personalization → Custom Instructions`,
    };
  }

  private async processMemories(
    entries: MemoryEntry[],
    limit: number,
    outputDir: string,
  ): Promise<{ count: number; warnings: string[]; manualStep?: string }> {
    const warnings: string[] = [];
    let processedEntries = entries;

    // Truncate to memory limit
    if (entries.length > limit) {
      processedEntries = entries.slice(0, limit);
      warnings.push(`Memories truncated: ${entries.length} → ${limit} (ChatGPT limit)`);
    }

    // Format memories for manual addition
    const formattedMemories = this.formatMemoriesForManualEntry(processedEntries);
    const memoriesFile = join(outputDir, 'memories.md');
    await writeFile(memoriesFile, formattedMemories);

    // Also write as JSON for programmatic access
    const memoriesJsonFile = join(outputDir, 'memories.json');
    await writeFile(memoriesJsonFile, JSON.stringify(processedEntries, null, 2));

    this.state.memoriesProcessed = true;

    return {
      count: processedEntries.length,
      warnings,
      manualStep: `Add memories from "${memoriesFile}" to ChatGPT Settings → Personalization → Memory. Each bullet point is a separate memory entry.`,
    };
  }

  private formatMemoriesForManualEntry(entries: MemoryEntry[]): string {
    const lines: string[] = [
      '# ChatGPT Memories to Add',
      '',
      '> Each bullet point below should be added as a separate memory in ChatGPT.',
      '> Go to: ChatGPT → Settings → Personalization → Memory → Manage',
      '> Click "Create memory" for each entry.',
      '',
      '---',
      '',
    ];

    // Group by category if available
    const byCategory = new Map<string, MemoryEntry[]>();
    for (const entry of entries) {
      const category = entry.category || 'General';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(entry);
    }

    for (const [category, items] of byCategory) {
      lines.push(`## ${category}`, '');
      for (const item of items) {
        // Truncate individual memories if needed (ChatGPT has ~500 char limit per memory)
        const content = item.content.length > 450 
          ? item.content.substring(0, 447) + '...'
          : item.content;
        lines.push(`- ${content}`);
      }
      lines.push('');
    }

    lines.push('---', '', `Total: ${entries.length} memories`);

    return lines.join('\n');
  }

  private async uploadFile(
    file: FileEntry,
    bundle: MigrationBundle,
    sizeLimit: number,
  ): Promise<{ success: boolean; fileId?: string; warning?: string }> {
    // Check file size
    if (file.size > sizeLimit) {
      return {
        success: false,
        warning: `File ${file.filename} exceeds size limit (${file.size} > ${sizeLimit} bytes)`,
      };
    }

    // Validate file path is within bundle directory to prevent path traversal
    const bundleDir = bundle.source.bundlePath || process.cwd();
    const resolvedPath = resolve(bundleDir, file.path);
    const rel = relative(bundleDir, resolvedPath);

    if (rel.startsWith('..') || resolve(rel) === rel) {
      return {
        success: false,
        warning: `Invalid file path: ${file.path}`,
      };
    }

    // Read file content using the validated path
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        warning: `File not found: ${resolvedPath}`,
      };
    }

    const content = await readFile(resolvedPath);
    const result = await this.client.uploadFile(
      basename(file.filename),
      content,
      'assistants',
    );

    return { success: true, fileId: result.id };
  }

  private async generateFileManifest(
    files: FileEntry[],
    outputDir: string,
  ): Promise<{ warning: string; manualStep?: string }> {
    const manifestLines: string[] = [
      '# Files to Upload to ChatGPT',
      '',
      '> These files were part of your migration bundle.',
      '> Upload them manually to ChatGPT or use with the Assistants API.',
      '',
      '| Filename | Size | Type | Path |',
      '|----------|------|------|------|',
    ];

    for (const file of files) {
      const sizeKB = Math.round(file.size / 1024);
      manifestLines.push(`| ${file.filename} | ${sizeKB} KB | ${file.mimeType} | ${file.path} |`);
    }

    const manifestFile = join(outputDir, 'files-manifest.md');
    await writeFile(manifestFile, manifestLines.join('\n'));

    return {
      warning: `No API key provided. ${files.length} files need manual upload. See ${manifestFile}`,
      manualStep: `Upload files listed in "${manifestFile}" to ChatGPT when starting a conversation, or use them with an Assistant.`,
    };
  }

  private async generateGPTGuides(
    bots: Array<{
      id: string;
      name: string;
      description?: string;
      instructions: string;
      knowledgeFiles?: string[];
      capabilities?: string[];
      createdAt: string;
    }>,
    outputDir: string,
  ): Promise<{ warning?: string; manualStep?: string }> {
    const gptsDir = join(outputDir, 'gpts');
    await mkdir(gptsDir, { recursive: true });

    for (const bot of bots) {
      const gptGuide = this.formatGPTGuide(bot);
      const safeFilename = bot.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
      const gptFile = join(gptsDir, `${safeFilename}.md`);
      await writeFile(gptFile, gptGuide);
    }

    // Create an index file
    const indexLines: string[] = [
      '# Custom GPTs to Create',
      '',
      '> These GPT configurations were extracted from your previous assistant.',
      '> Create them manually at: https://chat.openai.com/gpts/editor',
      '',
      '## GPTs',
      '',
    ];

    for (const bot of bots) {
      const safeFilename = bot.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
      indexLines.push(`- [${bot.name}](gpts/${safeFilename}.md)`);
    }

    const indexFile = join(outputDir, 'gpts-index.md');
    await writeFile(indexFile, indexLines.join('\n'));

    return {
      warning: `${bots.length} GPT configurations exported. Manual creation required.`,
      manualStep: `Create custom GPTs using the guides in "${gptsDir}/". Visit https://chat.openai.com/gpts/editor to create each one.`,
    };
  }

  private formatGPTGuide(bot: {
    name: string;
    description?: string;
    instructions: string;
    knowledgeFiles?: string[];
    capabilities?: string[];
  }): string {
    const lines: string[] = [
      `# ${bot.name}`,
      '',
      '## How to Create This GPT',
      '',
      '1. Go to https://chat.openai.com/gpts/editor',
      '2. Click "Create a GPT"',
      '3. Configure using the settings below',
      '',
      '---',
      '',
      '## Configuration',
      '',
      '### Name',
      '',
      bot.name,
      '',
      '### Description',
      '',
      bot.description || '(No description)',
      '',
      '### Instructions',
      '',
      '```',
      bot.instructions,
      '```',
      '',
    ];

    if (bot.capabilities && bot.capabilities.length > 0) {
      lines.push('### Capabilities', '');
      for (const cap of bot.capabilities) {
        lines.push(`- ${cap}`);
      }
      lines.push('');
    }

    if (bot.knowledgeFiles && bot.knowledgeFiles.length > 0) {
      lines.push('### Knowledge Files', '');
      for (const file of bot.knowledgeFiles) {
        lines.push(`- ${file}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private async generateReadme(
    outputDir: string,
    stats: {
      instructionsLoaded: boolean;
      memoriesLoaded: number;
      filesLoaded: number;
      hasApiKey: boolean;
      totalFiles: number;
      hasGPTs: boolean;
    },
  ): Promise<void> {
    const lines: string[] = [
      '# ChatGPT Migration Package',
      '',
      `> Generated: ${new Date().toISOString()}`,
      '',
      '## Overview',
      '',
      'This package contains your migrated data from Claude, ready to be applied to ChatGPT.',
      '',
      '## Status',
      '',
      `| Item | Status |`,
      `|------|--------|`,
      `| Custom Instructions | ${stats.instructionsLoaded ? '✅ Ready' : '❌ None'} |`,
      `| Memories | ${stats.memoriesLoaded > 0 ? `✅ ${stats.memoriesLoaded} entries` : '❌ None'} |`,
      `| Files | ${stats.filesLoaded > 0 ? `✅ ${stats.filesLoaded} uploaded` : stats.totalFiles > 0 ? `⏳ ${stats.totalFiles} pending` : '❌ None'} |`,
      `| Custom GPTs | ${stats.hasGPTs ? '⏳ Guides generated' : '❌ None'} |`,
      '',
      '## Manual Steps Required',
      '',
    ];

    if (stats.instructionsLoaded) {
      lines.push(
        '### 1. Set Custom Instructions',
        '',
        '1. Open ChatGPT → Settings (⚙️) → Personalization → Custom Instructions',
        '2. Open `custom-instructions.txt` in this folder',
        '3. Copy the content into the "How would you like ChatGPT to respond?" field',
        '4. Save',
        '',
      );
    }

    if (stats.memoriesLoaded > 0) {
      lines.push(
        '### 2. Add Memories',
        '',
        '1. Open ChatGPT → Settings (⚙️) → Personalization → Memory → Manage',
        '2. Open `memories.md` in this folder',
        '3. For each bullet point, click "Create memory" and paste the content',
        '4. Repeat for all memories (or prioritize the most important ones)',
        '',
        `> Note: ChatGPT has a limit of ~100 memories. ${stats.memoriesLoaded} memories are included.`,
        '',
      );
    }

    if (stats.totalFiles > 0 && !stats.hasApiKey) {
      lines.push(
        '### 3. Upload Files',
        '',
        '1. See `files-manifest.md` for the list of files',
        '2. Upload files to ChatGPT when starting a new conversation',
        '3. Or use the OpenAI API with an API key for programmatic upload',
        '',
      );
    }

    if (stats.hasGPTs) {
      lines.push(
        '### 4. Create Custom GPTs',
        '',
        '1. See the `gpts/` folder for configuration guides',
        '2. Visit https://chat.openai.com/gpts/editor',
        '3. Create each GPT using the provided instructions',
        '',
      );
    }

    lines.push(
      '## Files in This Package',
      '',
      '```',
      outputDir + '/',
    );

    if (stats.instructionsLoaded) {
      lines.push('├── custom-instructions.txt  # Copy to ChatGPT settings');
      lines.push('├── custom-instructions-full.txt  # Full content (if truncated)');
    }

    if (stats.memoriesLoaded > 0) {
      lines.push('├── memories.md  # Memories to add manually');
      lines.push('├── memories.json  # Memories in JSON format');
    }

    if (stats.totalFiles > 0) {
      lines.push('├── files-manifest.md  # List of files to upload');
    }

    if (stats.hasGPTs) {
      lines.push('├── gpts-index.md  # Index of GPT configurations');
      lines.push('└── gpts/  # GPT configuration guides');
    }

    lines.push('```', '', '---', '', 'Need help? Visit https://savestate.dev/docs/migration');

    const readmeFile = join(outputDir, 'README.md');
    await writeFile(readmeFile, lines.join('\n'));
  }

  private dryRunResult(bundle: MigrationBundle, warnings: string[]): LoadResult {
    const capabilities = getPlatformCapabilities('chatgpt');

    // Check for potential issues
    if (
      bundle.contents.instructions?.content &&
      bundle.contents.instructions.content.length > capabilities.instructionLimit
    ) {
      warnings.push(
        `Instructions would be truncated: ${bundle.contents.instructions.content.length} > ${capabilities.instructionLimit} chars`,
      );
    }

    if (
      bundle.contents.memories?.entries &&
      bundle.contents.memories.entries.length > capabilities.memoryLimit!
    ) {
      warnings.push(
        `Memories would be truncated: ${bundle.contents.memories.entries.length} > ${capabilities.memoryLimit} entries`,
      );
    }

    if (bundle.contents.files?.files) {
      for (const file of bundle.contents.files.files) {
        if (file.size > capabilities.fileSizeLimit!) {
          warnings.push(`File ${file.filename} exceeds size limit`);
        }
      }
    }

    warnings.push('Dry run - no changes made');

    const manualSteps: string[] = [
      'Custom Instructions: Must be copied manually to ChatGPT settings',
      'Memories: Must be added manually in ChatGPT settings',
    ];

    if (!this.client.hasApiKey()) {
      manualSteps.push('Files: Must be uploaded manually (no API key provided)');
    }

    if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
      manualSteps.push(`${bundle.contents.customBots.count} GPT(s): Must be created manually`);
    }

    return {
      success: true,
      loaded: {
        instructions: !!bundle.contents.instructions,
        memories: bundle.contents.memories?.count ?? 0,
        files: bundle.contents.files?.count ?? 0,
        customBots: 0,
      },
      warnings,
      errors: [],
      manualSteps,
    };
  }
}
