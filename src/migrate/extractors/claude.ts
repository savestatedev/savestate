/**
 * Claude Extractor
 *
 * Extracts user data from Claude Projects including:
 * - System prompts (per-project instructions)
 * - Project knowledge documents
 * - Project files (attachments)
 * - Artifacts (if applicable)
 *
 * Supports both API-based extraction and export file parsing.
 * For API access: Uses Claude Projects API
 * For export: Parses Claude data export files
 */

import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, stat, readdir, access, constants } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

import type {
  Platform,
  Extractor,
  ExtractOptions,
  MigrationBundle,
  MigrationContents,
  MigrationMetadata,
  MemoryEntry,
  ConversationSummary,
  FileEntry,
  CustomBotEntry,
  InstructionSection,
} from '../types.js';

// ─── Configuration ───────────────────────────────────────────

export interface ClaudeExtractorConfig {
  /** Anthropic API key (for API-based extraction) */
  apiKey?: string;
  /** Path to Claude export folder (for export-based extraction) */
  exportPath?: string;
  /** API base URL (defaults to https://api.anthropic.com) */
  baseUrl?: string;
  /** Organization ID (if applicable) */
  organizationId?: string;
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Maximum projects to process (for testing/limits) */
  maxProjects?: number;
  /** Specific project IDs to extract (if not set, all projects) */
  projectIds?: string[];
}

export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute?: number;
  /** Initial backoff delay in ms */
  initialBackoffMs?: number;
  /** Maximum backoff delay in ms */
  maxBackoffMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
}

// ─── Claude API Types ────────────────────────────────────────

interface ClaudeProject {
  id: string;
  name: string;
  description?: string;
  prompt_template?: string;
  is_starred?: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

interface ClaudeProjectDocument {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ClaudeProjectFile {
  id: string;
  name: string;
  content_type: string;
  size: number;
  created_at: string;
}

interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_uuid?: string;
  chat_messages: ClaudeChatMessage[];
}

interface ClaudeChatMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  created_at: string;
  updated_at: string;
  attachments?: ClaudeAttachment[];
  content?: ClaudeMessageContent[];
}

interface ClaudeMessageContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'artifact';
  text?: string;
  artifact?: ClaudeArtifact;
}

interface ClaudeArtifact {
  id: string;
  type: string;
  title: string;
  content: string;
  language?: string;
}

interface ClaudeAttachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content?: string;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
  retryAfter?: number;
}

// ─── Rate Limiter ────────────────────────────────────────────

class RateLimiter {
  private requests: number[] = [];
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      requestsPerMinute: config.requestsPerMinute ?? 50,
      initialBackoffMs: config.initialBackoffMs ?? 1000,
      maxBackoffMs: config.maxBackoffMs ?? 60000,
      maxRetries: config.maxRetries ?? 5,
    };
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60000;

    // Remove old requests outside the window
    this.requests = this.requests.filter((t) => t > windowStart);

    // If at limit, wait
    if (this.requests.length >= this.config.requestsPerMinute) {
      const oldestInWindow = this.requests[0];
      const waitTime = oldestInWindow - windowStart + 100;
      await this.sleep(waitTime);
    }

    this.requests.push(Date.now());
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let backoff = this.config.initialBackoffMs;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.acquire();
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error
        if (this.isRateLimitError(lastError)) {
          if (attempt < this.config.maxRetries) {
            await this.sleep(backoff);
            backoff = Math.min(backoff * 2, this.config.maxBackoffMs);
            continue;
          }
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  private isRateLimitError(error: Error): boolean {
    return (
      error.message.includes('429') ||
      error.message.includes('rate limit') ||
      error.message.includes('Rate limit') ||
      error.message.includes('Too Many Requests')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Claude API Client ───────────────────────────────────────

class ClaudeApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organizationId?: string;
  private readonly rateLimiter: RateLimiter;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(config: ClaudeExtractorConfig) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.organizationId = config.organizationId;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.maxRetries = config.rateLimit?.maxRetries ?? 3;
    this.retryDelayMs = config.rateLimit?.initialBackoffMs ?? 1000;
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
      'anthropic-version': '2024-10-01',
      'x-api-key': this.apiKey,
    };

    if (this.organizationId) {
      headers['anthropic-organization'] = this.organizationId;
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

  private async requestBinary(path: string, retryCount = 0): Promise<Buffer> {
    await this.rateLimiter.acquire();

    const headers: Record<string, string> = {
      'anthropic-version': '2024-10-01',
      'x-api-key': this.apiKey,
    };

    if (this.organizationId) {
      headers['anthropic-organization'] = this.organizationId;
    }

    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        if (response.status >= 500 && retryCount < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, retryCount));
          return this.requestBinary(path, retryCount + 1);
        }
        throw new Error(`Failed to download: ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message.includes('fetch') &&
        retryCount < this.maxRetries
      ) {
        await this.sleep(this.retryDelayMs * Math.pow(2, retryCount));
        return this.requestBinary(path, retryCount + 1);
      }
      throw err;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Projects API ────────────────────────────────────────

  async listProjects(): Promise<{ data: ClaudeProject[] }> {
    return this.request<{ data: ClaudeProject[] }>('GET', '/v1/projects');
  }

  async getProject(projectId: string): Promise<ClaudeProject> {
    return this.request<ClaudeProject>('GET', `/v1/projects/${projectId}`);
  }

  async listProjectDocuments(projectId: string): Promise<{ data: ClaudeProjectDocument[] }> {
    return this.request<{ data: ClaudeProjectDocument[] }>('GET', `/v1/projects/${projectId}/docs`);
  }

  async getProjectDocument(projectId: string, docId: string): Promise<ClaudeProjectDocument> {
    return this.request<ClaudeProjectDocument>('GET', `/v1/projects/${projectId}/docs/${docId}`);
  }

  async listProjectFiles(projectId: string): Promise<{ data: ClaudeProjectFile[] }> {
    return this.request<{ data: ClaudeProjectFile[] }>('GET', `/v1/projects/${projectId}/files`);
  }

  async downloadProjectFile(projectId: string, fileId: string): Promise<Buffer> {
    return this.requestBinary(`/v1/projects/${projectId}/files/${fileId}/content`);
  }
}

// ─── Claude Extractor ────────────────────────────────────────

export class ClaudeExtractor implements Extractor {
  readonly platform: Platform = 'claude';
  readonly version = '1.0.0';

  private config: ClaudeExtractorConfig;
  private client: ClaudeApiClient;
  private progress = 0;

  constructor(config: ClaudeExtractorConfig = {}) {
    this.config = config;
    this.client = new ClaudeApiClient(config);
  }

  async canExtract(): Promise<boolean> {
    // Check if we have either API credentials or an export file
    if (this.config.apiKey || process.env.ANTHROPIC_API_KEY) {
      return this.verifyApiAccess();
    }

    if (this.config.exportPath) {
      return this.verifyExportPath();
    }

    return false;
  }

  async extract(options: ExtractOptions): Promise<MigrationBundle> {
    this.progress = 0;
    const workDir = options.workDir;
    await mkdir(workDir, { recursive: true });

    const contents: MigrationContents = {};
    const warnings: string[] = [];
    const errors: string[] = [];

    const shouldInclude = (type: string) =>
      !options.include || options.include.includes(type as never);

    // Determine extraction method
    const useApi = this.client.hasApiKey();
    const useExport = !!this.config.exportPath;

    try {
      if (useApi) {
        // API-based extraction
        const result = await this.extractViaApi(workDir, options, shouldInclude);
        Object.assign(contents, result.contents);
        warnings.push(...result.warnings);
        errors.push(...result.errors);
      } else if (useExport) {
        // Export-based extraction
        const result = await this.extractViaExport(workDir, options, shouldInclude);
        Object.assign(contents, result.contents);
        warnings.push(...result.warnings);
        errors.push(...result.errors);
      } else {
        throw new Error('No API key or export path configured');
      }

      this.progress = 100;
      options.onProgress?.(1.0, 'Extraction complete');

      // Build metadata
      const metadata: MigrationMetadata = {
        totalItems: this.countItems(contents),
        itemCounts: {
          instructions: contents.instructions ? 1 : 0,
          memories: contents.memories?.count ?? 0,
          conversations: contents.conversations?.count ?? 0,
          files: contents.files?.count ?? 0,
          customBots: contents.customBots?.count ?? 0,
        },
        warnings,
        errors,
      };

      // Build bundle
      const bundle: MigrationBundle = {
        version: '1.0',
        id: `bundle_${randomBytes(8).toString('hex')}`,
        source: {
          platform: 'claude',
          extractedAt: new Date().toISOString(),
          extractorVersion: this.version,
        },
        contents,
        metadata,
      };

      return bundle;
    } catch (error) {
      this.progress = 0;
      throw error;
    }
  }

  getProgress(): number {
    return this.progress;
  }

  // ─── API-based Extraction ──────────────────────────────────

  private async verifyApiAccess(): Promise<boolean> {
    try {
      await this.client.listProjects();
      return true;
    } catch {
      return false;
    }
  }

  private async extractViaApi(
    workDir: string,
    options: ExtractOptions,
    shouldInclude: (type: string) => boolean,
  ): Promise<{
    contents: MigrationContents;
    warnings: string[];
    errors: string[];
  }> {
    const contents: MigrationContents = {};
    const warnings: string[] = [];
    const errors: string[] = [];

    // Fetch all projects
    options.onProgress?.(0.05, 'Fetching Claude projects...');
    const projectsResponse = await this.client.listProjects();
    let projects = projectsResponse.data || [];

    // Filter by project IDs if specified
    if (this.config.projectIds && this.config.projectIds.length > 0) {
      projects = projects.filter((p) => this.config.projectIds!.includes(p.id));
    }

    // Apply max projects limit
    if (this.config.maxProjects && projects.length > this.config.maxProjects) {
      projects = projects.slice(0, this.config.maxProjects);
      warnings.push(`Limited to ${this.config.maxProjects} projects (${projectsResponse.data.length} available)`);
    }

    // Filter out archived projects unless explicitly requested
    projects = projects.filter((p) => !p.archived_at);

    this.progress = 10;
    options.onProgress?.(0.1, `Found ${projects.length} projects`);

    if (projects.length === 0) {
      warnings.push('No projects found to extract');
      return { contents, warnings, errors };
    }

    // Extract projects as "customBots" (Claude's equivalent)
    if (shouldInclude('customBots')) {
      const bots: CustomBotEntry[] = [];
      const allKnowledgeEntries: MemoryEntry[] = [];
      const allFiles: FileEntry[] = [];
      let totalFileSize = 0;

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        const projectProgress = 0.1 + (0.8 * (i + 1)) / projects.length;
        options.onProgress?.(projectProgress, `Extracting project: ${project.name}`);

        try {
          // Get full project details (includes system prompt)
          const fullProject = await this.client.getProject(project.id);

          // Extract project knowledge documents
          const docsResponse = await this.client.listProjectDocuments(project.id);
          const docs = docsResponse.data || [];
          const knowledgeFiles: string[] = [];

          for (const doc of docs) {
            // Get full document content
            const fullDoc = await this.client.getProjectDocument(project.id, doc.id);
            knowledgeFiles.push(fullDoc.name);

            // Store as memory entry (knowledge document)
            allKnowledgeEntries.push({
              id: `${project.id}_${doc.id}`,
              content: fullDoc.content,
              createdAt: fullDoc.created_at,
              updatedAt: fullDoc.updated_at,
              category: `Project: ${project.name}`,
              source: 'claude-project-knowledge',
            });
          }

          // Extract project files
          if (shouldInclude('files')) {
            const filesDir = join(workDir, 'files', this.sanitizeFilename(project.name));
            await mkdir(filesDir, { recursive: true });

            const filesResponse = await this.client.listProjectFiles(project.id);
            const files = filesResponse.data || [];

            for (const file of files) {
              try {
                const content = await this.client.downloadProjectFile(project.id, file.id);
                const safeFilename = this.sanitizeFilename(file.name);
                const filePath = join(filesDir, safeFilename);
                await writeFile(filePath, content);

                allFiles.push({
                  id: `${project.id}_${file.id}`,
                  filename: safeFilename,
                  mimeType: file.content_type,
                  size: file.size,
                  path: `files/${this.sanitizeFilename(project.name)}/${safeFilename}`,
                  uploadedAt: file.created_at,
                });
                totalFileSize += file.size;
                knowledgeFiles.push(file.name);
              } catch (err) {
                const msg = `Failed to download file ${file.name}: ${err instanceof Error ? err.message : err}`;
                warnings.push(msg);
              }
            }
          }

          // Add project as a "bot" entry
          bots.push({
            id: project.id,
            name: project.name,
            description: project.description,
            instructions: fullProject.prompt_template || '',
            knowledgeFiles: knowledgeFiles.length > 0 ? knowledgeFiles : undefined,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
          });
        } catch (err) {
          const msg = `Failed to extract project ${project.name}: ${err instanceof Error ? err.message : err}`;
          errors.push(msg);
        }

        this.progress = projectProgress * 100;
      }

      contents.customBots = {
        bots,
        count: bots.length,
      };

      // Store knowledge entries as memories
      if (allKnowledgeEntries.length > 0) {
        contents.memories = {
          entries: allKnowledgeEntries,
          count: allKnowledgeEntries.length,
        };
      }

      // Store files
      if (allFiles.length > 0) {
        contents.files = {
          files: allFiles,
          count: allFiles.length,
          totalSize: totalFileSize,
        };
      }

      // Combine system prompts from all projects for instructions
      if (shouldInclude('instructions')) {
        const combinedInstructions = bots
          .filter((b) => b.instructions)
          .map((b) => `# ${b.name}\n\n${b.instructions}`)
          .join('\n\n---\n\n');

        if (combinedInstructions) {
          contents.instructions = {
            content: combinedInstructions,
            length: combinedInstructions.length,
            sections: this.parseInstructionSections(combinedInstructions),
          };
        }
      }
    }

    this.progress = 90;
    return { contents, warnings, errors };
  }

  // ─── Export-based Extraction ───────────────────────────────

  private async verifyExportPath(): Promise<boolean> {
    if (!this.config.exportPath) return false;

    try {
      await access(this.config.exportPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async extractViaExport(
    workDir: string,
    options: ExtractOptions,
    shouldInclude: (type: string) => boolean,
  ): Promise<{
    contents: MigrationContents;
    warnings: string[];
    errors: string[];
  }> {
    const contents: MigrationContents = {};
    const warnings: string[] = [];
    const errors: string[] = [];
    const exportPath = this.config.exportPath!;

    // Claude export typically contains:
    // - conversations.json (or folder with individual conversation files)
    // - potentially projects.json if exported via certain methods

    options.onProgress?.(0.1, 'Scanning Claude export...');
    this.progress = 10;

    // Try to find conversations
    if (shouldInclude('conversations')) {
      try {
        const convResult = await this.extractConversationsFromExport(exportPath, workDir, options);
        if (convResult) {
          contents.conversations = convResult.conversations;
          if (convResult.artifacts.length > 0) {
            // Store artifacts as files
            const artifactsDir = join(workDir, 'artifacts');
            await mkdir(artifactsDir, { recursive: true });

            const artifactFiles: FileEntry[] = [];
            for (const artifact of convResult.artifacts) {
              const filename = this.sanitizeFilename(artifact.filename);
              const filePath = join(artifactsDir, filename);
              await writeFile(filePath, artifact.content);
              artifactFiles.push({
                id: artifact.id,
                filename,
                mimeType: artifact.mimeType,
                size: artifact.content.length,
                path: `artifacts/${filename}`,
              });
            }

            contents.files = {
              files: artifactFiles,
              count: artifactFiles.length,
              totalSize: artifactFiles.reduce((sum, f) => sum + f.size, 0),
            };
          }
        }
      } catch (err) {
        const msg = `Failed to extract conversations: ${err instanceof Error ? err.message : err}`;
        errors.push(msg);
      }
    }
    this.progress = 60;
    options.onProgress?.(0.6, 'Conversations extracted');

    // Try to find projects data
    if (shouldInclude('customBots')) {
      try {
        const projectsJsonPath = join(exportPath, 'projects.json');
        const projectsDir = join(exportPath, 'projects');
        
        if (existsSync(projectsJsonPath)) {
          // Single projects.json file
          const projectsData = await this.extractProjectsFromExport(projectsJsonPath, workDir);
          if (projectsData) {
            contents.customBots = projectsData.customBots;
            if (projectsData.instructions) {
              contents.instructions = projectsData.instructions;
            }
            if (projectsData.memories) {
              contents.memories = projectsData.memories;
            }
          }
        } else if (existsSync(projectsDir)) {
          // Projects folder with individual files
          const projectsData = await this.extractProjectsFromDirectory(projectsDir, workDir);
          if (projectsData) {
            contents.customBots = projectsData.customBots;
            if (projectsData.instructions) {
              contents.instructions = projectsData.instructions;
            }
            if (projectsData.memories) {
              contents.memories = projectsData.memories;
            }
          }
        }
      } catch (err) {
        const msg = `Failed to extract projects: ${err instanceof Error ? err.message : err}`;
        warnings.push(msg);
      }
    }
    this.progress = 80;
    options.onProgress?.(0.8, 'Projects extracted');

    // Check for standalone memories file
    if (shouldInclude('memories') && !contents.memories) {
      try {
        const memoriesPaths = [
          join(exportPath, 'memories.json'),
          join(exportPath, 'claude-memories.md'),
          join(exportPath, 'memories.md'),
        ];

        for (const memoriesPath of memoriesPaths) {
          if (existsSync(memoriesPath)) {
            const memoriesData = await this.extractMemoriesFromFile(memoriesPath);
            if (memoriesData && memoriesData.count > 0) {
              contents.memories = memoriesData;
              break;
            }
          }
        }
      } catch (err) {
        const msg = `Failed to extract memories: ${err instanceof Error ? err.message : err}`;
        warnings.push(msg);
      }
    }
    this.progress = 85;

    // Check for standalone files directory
    if (shouldInclude('files')) {
      try {
        const filesDir = join(exportPath, 'files');
        if (existsSync(filesDir)) {
          const filesResult = await this.extractFilesFromDirectory(filesDir, workDir);
          if (filesResult && filesResult.count > 0) {
            // Merge with existing files
            if (contents.files) {
              contents.files.files.push(...filesResult.files);
              contents.files.count += filesResult.count;
              contents.files.totalSize += filesResult.totalSize;
            } else {
              contents.files = filesResult;
            }
          }
        }
      } catch (err) {
        const msg = `Failed to extract files: ${err instanceof Error ? err.message : err}`;
        warnings.push(msg);
      }
    }

    this.progress = 90;
    return { contents, warnings, errors };
  }

  private async extractConversationsFromExport(
    exportPath: string,
    workDir: string,
    options: ExtractOptions,
  ): Promise<{
    conversations: MigrationContents['conversations'];
    artifacts: Array<{ id: string; filename: string; content: string; mimeType: string }>;
  } | null> {
    const conversationsPath = join(exportPath, 'conversations.json');
    const outputDir = join(workDir, 'conversations');
    await mkdir(outputDir, { recursive: true });

    const summaries: ConversationSummary[] = [];
    let totalMessages = 0;
    const artifacts: Array<{ id: string; filename: string; content: string; mimeType: string }> = [];

    // Try conversations.json first
    if (existsSync(conversationsPath)) {
      const content = await readFile(conversationsPath, 'utf-8');
      const conversations = JSON.parse(content) as ClaudeConversation[];

      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];
        const progress = (i + 1) / conversations.length;
        options.onProgress?.(0.1 + progress * 0.5, `Processing conversation ${i + 1}/${conversations.length}`);

        const messages = this.extractMessagesFromConversation(conv);
        totalMessages += messages.length;

        // Extract artifacts from messages
        for (const msg of conv.chat_messages || []) {
          if (msg.content) {
            for (const content of msg.content) {
              if (content.type === 'artifact' && content.artifact) {
                const artifact = content.artifact;
                const ext = this.getArtifactExtension(artifact.type, artifact.language);
                artifacts.push({
                  id: artifact.id,
                  filename: `${this.sanitizeFilename(artifact.title)}${ext}`,
                  content: artifact.content,
                  mimeType: this.getArtifactMimeType(artifact.type, artifact.language),
                });
              }
            }
          }
        }

        // Save conversation
        const convData = {
          id: conv.uuid,
          title: conv.name || 'Untitled',
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          projectId: conv.project_uuid,
          messages,
        };

        const safeConvId = this.sanitizeFilename(conv.uuid);
        const convPath = join(outputDir, `${safeConvId}.json`);
        await writeFile(convPath, JSON.stringify(convData, null, 2));

        summaries.push({
          id: conv.uuid,
          title: conv.name || 'Untitled',
          messageCount: messages.length,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          keyPoints: this.extractKeyPoints(messages),
        });
      }

      return {
        conversations: {
          path: 'conversations/',
          count: summaries.length,
          messageCount: totalMessages,
          summaries,
        },
        artifacts,
      };
    }

    // Try individual conversation files in a folder
    const conversationsDir = join(exportPath, 'conversations');
    if (existsSync(conversationsDir)) {
      const files = await readdir(conversationsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (let i = 0; i < jsonFiles.length; i++) {
        const file = jsonFiles[i];
        const progress = (i + 1) / jsonFiles.length;
        options.onProgress?.(0.1 + progress * 0.5, `Processing conversation ${i + 1}/${jsonFiles.length}`);

        const convContent = await readFile(join(conversationsDir, file), 'utf-8');
        const conv = JSON.parse(convContent) as ClaudeConversation;

        const messages = this.extractMessagesFromConversation(conv);
        totalMessages += messages.length;

        // Extract artifacts
        for (const msg of conv.chat_messages || []) {
          if (msg.content) {
            for (const content of msg.content) {
              if (content.type === 'artifact' && content.artifact) {
                const artifact = content.artifact;
                const ext = this.getArtifactExtension(artifact.type, artifact.language);
                artifacts.push({
                  id: artifact.id,
                  filename: `${this.sanitizeFilename(artifact.title)}${ext}`,
                  content: artifact.content,
                  mimeType: this.getArtifactMimeType(artifact.type, artifact.language),
                });
              }
            }
          }
        }

        // Copy to work dir
        const safeConvId = this.sanitizeFilename(conv.uuid);
        const convPath = join(outputDir, `${safeConvId}.json`);
        await writeFile(convPath, JSON.stringify({
          id: conv.uuid,
          title: conv.name || 'Untitled',
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          projectId: conv.project_uuid,
          messages,
        }, null, 2));

        summaries.push({
          id: conv.uuid,
          title: conv.name || 'Untitled',
          messageCount: messages.length,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          keyPoints: this.extractKeyPoints(messages),
        });
      }

      if (summaries.length > 0) {
        return {
          conversations: {
            path: 'conversations/',
            count: summaries.length,
            messageCount: totalMessages,
            summaries,
          },
          artifacts,
        };
      }
    }

    return null;
  }

  private extractMessagesFromConversation(conv: ClaudeConversation): Array<{
    id: string;
    role: string;
    content: string;
    timestamp?: string;
    attachments?: Array<{ id: string; name: string; mimeType: string }>;
  }> {
    const messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp?: string;
      attachments?: Array<{ id: string; name: string; mimeType: string }>;
    }> = [];

    for (const msg of conv.chat_messages || []) {
      let content = msg.text || '';

      // Also include text from content blocks
      if (msg.content) {
        const textParts = msg.content
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text)
          .join('\n');
        if (textParts && !content) {
          content = textParts;
        }
      }

      if (!content.trim()) continue;

      const attachments = msg.attachments?.map((att) => ({
        id: att.id,
        name: att.file_name,
        mimeType: att.file_type,
      }));

      messages.push({
        id: msg.uuid,
        role: msg.sender === 'human' ? 'user' : 'assistant',
        content,
        timestamp: msg.created_at,
        attachments,
      });
    }

    return messages;
  }

  private async extractProjectsFromExport(
    projectsPath: string,
    workDir: string,
  ): Promise<{
    customBots: MigrationContents['customBots'];
    instructions?: MigrationContents['instructions'];
    memories?: MigrationContents['memories'];
  } | null> {
    const content = await readFile(projectsPath, 'utf-8');
    const projects = JSON.parse(content) as ClaudeProject[];

    const bots: CustomBotEntry[] = [];
    const allKnowledge: MemoryEntry[] = [];

    for (const project of projects) {
      bots.push({
        id: project.id,
        name: project.name,
        description: project.description,
        instructions: project.prompt_template || '',
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      });

      // If project has knowledge docs in export, extract them
      // This depends on export format - adapt as needed
    }

    const combinedInstructions = bots
      .filter((b) => b.instructions)
      .map((b) => `# ${b.name}\n\n${b.instructions}`)
      .join('\n\n---\n\n');

    return {
      customBots: { bots, count: bots.length },
      instructions: combinedInstructions
        ? {
            content: combinedInstructions,
            length: combinedInstructions.length,
            sections: this.parseInstructionSections(combinedInstructions),
          }
        : undefined,
      memories: allKnowledge.length > 0
        ? { entries: allKnowledge, count: allKnowledge.length }
        : undefined,
    };
  }

  private async extractProjectsFromDirectory(
    projectsDir: string,
    workDir: string,
  ): Promise<{
    customBots: MigrationContents['customBots'];
    instructions?: MigrationContents['instructions'];
    memories?: MigrationContents['memories'];
  } | null> {
    const bots: CustomBotEntry[] = [];
    const allKnowledge: MemoryEntry[] = [];

    const entries = await readdir(projectsDir);

    for (const entry of entries) {
      const entryPath = join(projectsDir, entry);
      const stats = await stat(entryPath);

      if (stats.isFile() && entry.endsWith('.json')) {
        // Individual project JSON file
        try {
          const content = await readFile(entryPath, 'utf-8');
          const project = JSON.parse(content) as ClaudeProject & { 
            system_prompt?: string;
            docs?: Array<{ title?: string; content?: string }>;
            knowledge?: Array<{ title?: string; content?: string }>;
          };

          const knowledgeFiles: string[] = [];

          // Extract inline knowledge docs
          const inlineDocs = project.docs ?? project.knowledge ?? [];
          for (const doc of inlineDocs) {
            if (doc.content) {
              const filename = `${doc.title ?? 'doc'}.md`;
              knowledgeFiles.push(filename);
              // Also add to memory entries
              allKnowledge.push({
                id: `${project.id}_${filename}`,
                content: doc.content,
                createdAt: project.created_at,
                source: 'claude-project',
              });
            }
          }

          bots.push({
            id: project.id,
            name: project.name,
            description: project.description,
            instructions: project.prompt_template ?? project.system_prompt ?? '',
            knowledgeFiles,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
          });
        } catch {
          // Skip invalid JSON files
          continue;
        }
      } else if (stats.isDirectory()) {
        // Project folder with metadata.json or project.json
        const metadataFiles = ['metadata.json', 'project.json', 'info.json'];
        let projectData: (ClaudeProject & { 
          system_prompt?: string;
          docs?: Array<{ title?: string; content?: string }>;
          knowledge?: Array<{ title?: string; content?: string }>;
        }) | null = null;

        for (const metaFile of metadataFiles) {
          const metaPath = join(entryPath, metaFile);
          if (existsSync(metaPath)) {
            try {
              const content = await readFile(metaPath, 'utf-8');
              projectData = JSON.parse(content);
              break;
            } catch {
              continue;
            }
          }
        }

        if (projectData) {
          const knowledgeFiles: string[] = [];

          // Check for knowledge subdirectory
          const knowledgeDir = join(entryPath, 'knowledge');
          const docsDir = join(entryPath, 'docs');
          const targetDir = existsSync(knowledgeDir) ? knowledgeDir : existsSync(docsDir) ? docsDir : null;

          if (targetDir) {
            const docs = await readdir(targetDir);
            for (const doc of docs) {
              knowledgeFiles.push(doc);
              // Read content for memory entries
              try {
                const docContent = await readFile(join(targetDir, doc), 'utf-8');
                allKnowledge.push({
                  id: `${projectData.id}_${doc}`,
                  content: docContent,
                  createdAt: projectData.created_at,
                  source: 'claude-project',
                });
              } catch {
                // Skip unreadable files
              }
            }
          }

          bots.push({
            id: projectData.id,
            name: projectData.name,
            description: projectData.description,
            instructions: projectData.prompt_template ?? projectData.system_prompt ?? '',
            knowledgeFiles,
            createdAt: projectData.created_at,
            updatedAt: projectData.updated_at,
          });
        }
      }
    }

    if (bots.length === 0) {
      return null;
    }

    const combinedInstructions = bots
      .filter((b) => b.instructions)
      .map((b) => `# ${b.name}\n\n${b.instructions}`)
      .join('\n\n---\n\n');

    return {
      customBots: { bots, count: bots.length },
      instructions: combinedInstructions
        ? {
            content: combinedInstructions,
            length: combinedInstructions.length,
            sections: this.parseInstructionSections(combinedInstructions),
          }
        : undefined,
      memories: allKnowledge.length > 0
        ? { entries: allKnowledge, count: allKnowledge.length }
        : undefined,
    };
  }

  private async extractMemoriesFromFile(
    memoriesPath: string,
  ): Promise<MigrationContents['memories'] | null> {
    const content = await readFile(memoriesPath, 'utf-8');
    const entries: MemoryEntry[] = [];

    if (memoriesPath.endsWith('.json')) {
      // JSON format
      const data = JSON.parse(content);
      const memoryArray = Array.isArray(data) ? data : data.memories ?? [];

      for (const mem of memoryArray) {
        entries.push({
          id: mem.id ?? mem.uuid ?? `mem_${randomBytes(4).toString('hex')}`,
          content: mem.content ?? mem.text ?? String(mem),
          createdAt: mem.created_at ?? new Date().toISOString(),
          updatedAt: mem.updated_at,
          source: 'claude',
        });
      }
    } else {
      // Markdown/text format - parse line by line
      const lines = content.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        // Skip headers and separators
        if (line.startsWith('#') || line.startsWith('---')) continue;

        // Remove bullet points if present
        const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
        if (cleanLine) {
          entries.push({
            id: `mem_${randomBytes(4).toString('hex')}`,
            content: cleanLine,
            createdAt: new Date().toISOString(),
            source: 'claude',
          });
        }
      }
    }

    if (entries.length === 0) {
      return null;
    }

    return {
      entries,
      count: entries.length,
    };
  }

  private async extractFilesFromDirectory(
    filesDir: string,
    workDir: string,
  ): Promise<MigrationContents['files']> {
    const outputDir = join(workDir, 'files');
    await mkdir(outputDir, { recursive: true });

    const entries: FileEntry[] = [];
    let totalSize = 0;

    const files = await readdir(filesDir);
    for (const filename of files) {
      const sourcePath = join(filesDir, filename);
      const stats = await stat(sourcePath);

      if (stats.isFile()) {
        const content = await readFile(sourcePath);
        const safeFilename = this.sanitizeFilename(filename);
        const destPath = join(outputDir, safeFilename);
        await writeFile(destPath, content);

        entries.push({
          id: createHash('md5').update(safeFilename).digest('hex'),
          filename: safeFilename,
          mimeType: this.guessMimeType(safeFilename),
          size: stats.size,
          path: `files/${safeFilename}`,
        });
        totalSize += stats.size;
      }
    }

    return {
      files: entries,
      count: entries.length,
      totalSize,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private parseInstructionSections(content: string): InstructionSection[] {
    const sections: InstructionSection[] = [];
    const lines = content.split('\n');

    let currentSection: InstructionSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#+)\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        const level = headerMatch[1].length;
        currentSection = {
          title: headerMatch[2],
          content: '',
          priority: level === 1 ? 'high' : level === 2 ? 'medium' : 'low',
        };
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  private extractKeyPoints(
    messages: Array<{ role: string; content: string }>,
  ): string[] {
    const keyPoints: string[] = [];
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    for (const msg of assistantMessages.slice(-5)) {
      const content = msg.content;

      // Look for conclusion markers
      const conclusionPatterns = [
        /(?:in summary|to summarize|in conclusion|the key points? (?:are|is)):?\s*(.{20,200})/gi,
        /(?:the (?:main|key) takeaway is):?\s*(.{20,200})/gi,
        /(?:decided|agreed|concluded) (?:to|that):?\s*(.{20,200})/gi,
      ];

      for (const pattern of conclusionPatterns) {
        const match = pattern.exec(content);
        if (match?.[1]) {
          keyPoints.push(match[1].trim());
        }
      }
    }

    return keyPoints.slice(0, 5);
  }

  private sanitizeFilename(filename: string): string {
    return basename(filename)
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 200);
  }

  private guessMimeType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.py': 'text/x-python',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.zip': 'application/zip',
    };

    return mimeTypes[ext] ?? 'application/octet-stream';
  }

  private getArtifactExtension(type: string, language?: string): string {
    // Map artifact types to file extensions
    const typeExtensions: Record<string, string> = {
      'application/vnd.ant.code': language ? `.${language}` : '.txt',
      'text/markdown': '.md',
      'text/html': '.html',
      'image/svg+xml': '.svg',
      'application/vnd.ant.mermaid': '.mmd',
      'application/vnd.ant.react': '.tsx',
    };

    const languageExtensions: Record<string, string> = {
      python: '.py',
      javascript: '.js',
      typescript: '.ts',
      java: '.java',
      cpp: '.cpp',
      c: '.c',
      rust: '.rs',
      go: '.go',
      ruby: '.rb',
      php: '.php',
      swift: '.swift',
      kotlin: '.kt',
      scala: '.scala',
      shell: '.sh',
      bash: '.sh',
      sql: '.sql',
      html: '.html',
      css: '.css',
      json: '.json',
      yaml: '.yaml',
      xml: '.xml',
    };

    if (language && languageExtensions[language.toLowerCase()]) {
      return languageExtensions[language.toLowerCase()];
    }

    return typeExtensions[type] ?? '.txt';
  }

  private getArtifactMimeType(type: string, language?: string): string {
    // Direct type mapping
    if (type === 'text/markdown') return 'text/markdown';
    if (type === 'text/html') return 'text/html';
    if (type === 'image/svg+xml') return 'image/svg+xml';

    // Language-based mapping
    const languageMimes: Record<string, string> = {
      python: 'text/x-python',
      javascript: 'text/javascript',
      typescript: 'text/typescript',
      html: 'text/html',
      css: 'text/css',
      json: 'application/json',
      shell: 'application/x-sh',
      bash: 'application/x-sh',
    };

    if (language && languageMimes[language.toLowerCase()]) {
      return languageMimes[language.toLowerCase()];
    }

    return 'text/plain';
  }

  private countItems(contents: MigrationContents): number {
    return (
      (contents.instructions ? 1 : 0) +
      (contents.memories?.count ?? 0) +
      (contents.conversations?.count ?? 0) +
      (contents.files?.count ?? 0) +
      (contents.customBots?.count ?? 0)
    );
  }
}
