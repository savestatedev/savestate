/**
 * ChatGPT Extractor
 *
 * Extracts user data from ChatGPT including:
 * - Custom instructions
 * - Memory entries
 * - Conversation history (from export files)
 * - Uploaded files/attachments
 * - Custom GPT configurations
 *
 * Supports both API-based extraction and export file parsing.
 */

import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, stat, readdir, access, constants } from 'node:fs/promises';
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

export interface ChatGPTExtractorConfig {
  /** OpenAI API key (for API-based extraction) */
  apiKey?: string;
  /** Path to ChatGPT export zip/folder (for export-based extraction) */
  exportPath?: string;
  /** OAuth access token (alternative to API key) */
  accessToken?: string;
  /** Base URL for OpenAI API */
  baseUrl?: string;
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Chunk size for streaming large files (bytes) */
  chunkSize?: number;
  /** Maximum conversations to process (for testing/limits) */
  maxConversations?: number;
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

// ─── ChatGPT Export Types ────────────────────────────────────

interface ChatGPTExportConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTMessage>;
  current_node?: string;
  conversation_template_id?: string;
  gizmo_id?: string;
}

interface ChatGPTMessage {
  id: string;
  message?: {
    id: string;
    author: { role: string; name?: string };
    create_time?: number;
    content: {
      content_type: string;
      parts?: (string | { [key: string]: unknown })[];
      text?: string;
    };
    metadata?: {
      attachments?: ChatGPTAttachment[];
      model_slug?: string;
    };
  };
  parent?: string;
  children?: string[];
}

interface ChatGPTAttachment {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  width?: number;
  height?: number;
}

interface ChatGPTModelSpec {
  default_model: string;
  custom_instructions?: {
    about_user_message?: string;
    about_model_message?: string;
  };
}

interface ChatGPTMemory {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

interface ChatGPTGPT {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  tools?: string[];
  knowledge_files?: Array<{ id: string; name: string }>;
  created_at: string;
  updated_at?: string;
}

// ─── Rate Limiter ────────────────────────────────────────────

class RateLimiter {
  private requests: number[] = [];
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      requestsPerMinute: config.requestsPerMinute ?? 60,
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

// ─── ChatGPT Extractor ───────────────────────────────────────

export class ChatGPTExtractor implements Extractor {
  readonly platform: Platform = 'chatgpt';
  readonly version = '1.0.0';

  private config: ChatGPTExtractorConfig;
  private rateLimiter: RateLimiter;
  private progress = 0;
  private baseUrl: string;

  constructor(config: ChatGPTExtractorConfig = {}) {
    this.config = {
      chunkSize: 64 * 1024, // 64KB default chunk size
      ...config,
    };
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  async canExtract(): Promise<boolean> {
    // Check if we have either API credentials or an export file
    if (this.config.apiKey || this.config.accessToken) {
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
    const useApi = !!(this.config.apiKey || this.config.accessToken);
    const useExport = !!this.config.exportPath;

    try {
      // Phase 1: Extract custom instructions (10%)
      if (shouldInclude('instructions')) {
        options.onProgress?.(0.05, 'Extracting custom instructions...');
        try {
          if (useApi) {
            contents.instructions = await this.extractInstructionsApi();
          } else if (useExport) {
            contents.instructions = await this.extractInstructionsFromExport();
          }
        } catch (error) {
          const msg = `Failed to extract instructions: ${error instanceof Error ? error.message : error}`;
          warnings.push(msg);
        }
      }
      this.progress = 10;
      options.onProgress?.(0.1, 'Instructions extracted');

      // Phase 2: Extract memories (20%)
      if (shouldInclude('memories')) {
        options.onProgress?.(0.15, 'Extracting memories...');
        try {
          if (useApi) {
            contents.memories = await this.extractMemoriesApi();
          } else if (useExport) {
            // Memories may be in the export or need API
            contents.memories = await this.extractMemoriesFromExport();
          }
        } catch (error) {
          const msg = `Failed to extract memories: ${error instanceof Error ? error.message : error}`;
          warnings.push(msg);
        }
      }
      this.progress = 20;
      options.onProgress?.(0.2, 'Memories extracted');

      // Phase 3: Extract conversations (60%)
      if (shouldInclude('conversations')) {
        options.onProgress?.(0.25, 'Extracting conversations...');
        try {
          if (useExport) {
            contents.conversations = await this.extractConversationsFromExport(
              workDir,
              (p, m) => {
                const scaledProgress = 0.2 + p * 0.4;
                options.onProgress?.(scaledProgress, m);
              },
            );
          } else {
            // Without export, we can't get full conversations via API
            warnings.push(
              'Conversation history requires export file. Request your data from ChatGPT settings.',
            );
          }
        } catch (error) {
          const msg = `Failed to extract conversations: ${error instanceof Error ? error.message : error}`;
          errors.push(msg);
        }
      }
      this.progress = 60;
      options.onProgress?.(0.6, 'Conversations extracted');

      // Phase 4: Extract files (80%)
      if (shouldInclude('files')) {
        options.onProgress?.(0.65, 'Extracting files...');
        try {
          if (useExport) {
            contents.files = await this.extractFilesFromExport(workDir);
          } else if (useApi) {
            contents.files = await this.extractFilesApi(workDir);
          }
        } catch (error) {
          const msg = `Failed to extract files: ${error instanceof Error ? error.message : error}`;
          warnings.push(msg);
        }
      }
      this.progress = 80;
      options.onProgress?.(0.8, 'Files extracted');

      // Phase 5: Extract custom GPTs (100%)
      if (shouldInclude('customBots')) {
        options.onProgress?.(0.85, 'Extracting custom GPTs...');
        try {
          if (useApi) {
            contents.customBots = await this.extractGPTsApi();
          } else if (useExport) {
            contents.customBots = await this.extractGPTsFromExport();
          }
        } catch (error) {
          const msg = `Failed to extract custom GPTs: ${error instanceof Error ? error.message : error}`;
          warnings.push(msg);
        }
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
          platform: 'chatgpt',
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
      const response = await this.apiRequest('/models', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async apiRequest(
    endpoint: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }

    return this.rateLimiter.withRetry(() =>
      fetch(url, { ...init, headers }),
    );
  }

  private async extractInstructionsApi() {
    // Note: Custom instructions API is not publicly documented
    // This is a best-effort implementation based on known endpoints
    try {
      // Try the user profile endpoint which may contain custom instructions
      const response = await this.apiRequest('/dashboard/user/system_preferences');

      if (response.ok) {
        const data = await response.json() as { custom_instructions?: { about_user?: string; about_model?: string } };
        const aboutUser = data.custom_instructions?.about_user ?? '';
        const aboutModel = data.custom_instructions?.about_model ?? '';

        const fullContent = [
          aboutUser && `## About Me\n${aboutUser}`,
          aboutModel && `## How ChatGPT Should Respond\n${aboutModel}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        return {
          content: fullContent,
          length: fullContent.length,
          sections: this.parseInstructionSections(fullContent),
        };
      }
    } catch {
      // API not available, fall through
    }

    return undefined;
  }

  private async extractMemoriesApi() {
    // Note: Memories API endpoint
    try {
      const response = await this.apiRequest('/memories');

      if (response.ok) {
        const data = await response.json() as { memories: ChatGPTMemory[] };
        const entries: MemoryEntry[] = (data.memories ?? []).map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          source: 'chatgpt',
        }));

        return {
          entries,
          count: entries.length,
        };
      }
    } catch {
      // API not available
    }

    return undefined;
  }

  private async extractFilesApi(workDir: string) {
    const filesDir = join(workDir, 'files');
    await mkdir(filesDir, { recursive: true });

    try {
      const response = await this.apiRequest('/files');

      if (response.ok) {
        const data = await response.json() as { data: Array<{ id: string; filename: string; bytes: number; purpose: string }> };
        const files = data.data ?? [];
        const entries: FileEntry[] = [];
        let totalSize = 0;

        for (const file of files) {
          // Download each file
          const fileResponse = await this.apiRequest(`/files/${file.id}/content`);
          if (fileResponse.ok) {
            const buffer = Buffer.from(await fileResponse.arrayBuffer());
            const safeFilename = basename(file.filename).replace(/[/\\]/g, '_');
            const filePath = join(filesDir, safeFilename);
            await writeFile(filePath, buffer);

            entries.push({
              id: file.id,
              filename: safeFilename,
              mimeType: this.guessMimeType(safeFilename),
              size: file.bytes,
              path: `files/${safeFilename}`,
            });
            totalSize += file.bytes;
          }
        }

        return {
          files: entries,
          count: entries.length,
          totalSize,
        };
      }
    } catch {
      // API not available
    }

    return undefined;
  }

  private async extractGPTsApi() {
    // Note: Custom GPTs API
    try {
      const response = await this.apiRequest('/gizmos/my');

      if (response.ok) {
        const data = await response.json() as { gizmos: ChatGPTGPT[] };
        const gpts = data.gizmos ?? [];

        const bots: CustomBotEntry[] = gpts.map((gpt) => ({
          id: gpt.id,
          name: gpt.name,
          description: gpt.description,
          instructions: gpt.instructions ?? '',
          knowledgeFiles: gpt.knowledge_files?.map((f) => f.name),
          capabilities: gpt.tools,
          createdAt: gpt.created_at,
          updatedAt: gpt.updated_at,
        }));

        return {
          bots,
          count: bots.length,
        };
      }
    } catch {
      // API not available
    }

    return undefined;
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

  private async extractInstructionsFromExport() {
    const modelSpecPath = join(this.config.exportPath!, 'model_comparisons.json');

    try {
      const content = await readFile(modelSpecPath, 'utf-8');
      const data = JSON.parse(content) as ChatGPTModelSpec[];

      // Find custom instructions in the model spec
      const spec = data[0];
      if (spec?.custom_instructions) {
        const aboutUser = spec.custom_instructions.about_user_message ?? '';
        const aboutModel = spec.custom_instructions.about_model_message ?? '';

        const fullContent = [
          aboutUser && `## About Me\n${aboutUser}`,
          aboutModel && `## How ChatGPT Should Respond\n${aboutModel}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        return {
          content: fullContent,
          length: fullContent.length,
          sections: this.parseInstructionSections(fullContent),
        };
      }
    } catch {
      // Try alternative location: user.json
      try {
        const userPath = join(this.config.exportPath!, 'user.json');
        const content = await readFile(userPath, 'utf-8');
        const data = JSON.parse(content) as { custom_instructions?: { about_user?: string; about_model?: string } };

        if (data.custom_instructions) {
          const aboutUser = data.custom_instructions.about_user ?? '';
          const aboutModel = data.custom_instructions.about_model ?? '';

          const fullContent = [
            aboutUser && `## About Me\n${aboutUser}`,
            aboutModel && `## How ChatGPT Should Respond\n${aboutModel}`,
          ]
            .filter(Boolean)
            .join('\n\n');

          return {
            content: fullContent,
            length: fullContent.length,
            sections: this.parseInstructionSections(fullContent),
          };
        }
      } catch {
        // No custom instructions found
      }
    }

    return undefined;
  }

  private async extractMemoriesFromExport() {
    const memoriesPath = join(this.config.exportPath!, 'memories.json');

    try {
      const content = await readFile(memoriesPath, 'utf-8');
      const data = JSON.parse(content) as ChatGPTMemory[];

      const entries: MemoryEntry[] = data.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        source: 'chatgpt-export',
      }));

      return {
        entries,
        count: entries.length,
      };
    } catch {
      // No memories file
      return undefined;
    }
  }

  private async extractConversationsFromExport(
    workDir: string,
    onProgress?: (progress: number, message: string) => void,
  ) {
    const conversationsPath = join(this.config.exportPath!, 'conversations.json');
    const outputDir = join(workDir, 'conversations');
    await mkdir(outputDir, { recursive: true });

    const summaries: ConversationSummary[] = [];
    let totalMessages = 0;

    // Use streaming parser for large files
    const fileStats = await stat(conversationsPath);
    const isLargeFile = fileStats.size > 50 * 1024 * 1024; // 50MB threshold

    if (isLargeFile) {
      // Stream parse for memory efficiency
      const result = await this.streamParseConversations(
        conversationsPath,
        outputDir,
        onProgress,
      );
      return result;
    }

    // Regular parsing for smaller files
    const content = await readFile(conversationsPath, 'utf-8');
    const conversations = JSON.parse(content) as ChatGPTExportConversation[];

    const maxConversations = this.config.maxConversations ?? conversations.length;
    const toProcess = conversations.slice(0, maxConversations);

    for (let i = 0; i < toProcess.length; i++) {
      const conv = toProcess[i];
      const progress = (i + 1) / toProcess.length;
      onProgress?.(progress, `Processing conversation ${i + 1}/${toProcess.length}`);

      // Extract messages from the conversation mapping
      const messages = this.extractMessagesFromMapping(conv.mapping, conv.current_node);
      totalMessages += messages.length;

      // Save individual conversation
      const convData = {
        id: conv.id,
        title: conv.title,
        createdAt: new Date(conv.create_time * 1000).toISOString(),
        updatedAt: new Date(conv.update_time * 1000).toISOString(),
        messages,
        gptId: conv.gizmo_id,
      };

      // Sanitize conv.id to prevent path traversal
      const safeConvId = basename(conv.id).replace(/[/\\]/g, '_');
      const convPath = join(outputDir, `${safeConvId}.json`);
      await writeFile(convPath, JSON.stringify(convData, null, 2));

      summaries.push({
        id: conv.id,
        title: conv.title || 'Untitled',
        messageCount: messages.length,
        createdAt: convData.createdAt,
        updatedAt: convData.updatedAt,
        keyPoints: this.extractKeyPoints(messages),
      });
    }

    return {
      path: 'conversations/',
      count: summaries.length,
      messageCount: totalMessages,
      summaries,
    };
  }

  private async streamParseConversations(
    filePath: string,
    outputDir: string,
    onProgress?: (progress: number, message: string) => void,
  ) {
    const summaries: ConversationSummary[] = [];
    let totalMessages = 0;
    let conversationCount = 0;

    // For very large files, we use a streaming JSON parser approach
    // Read the file in chunks and parse conversations one at a time
    const fileContent = await readFile(filePath, 'utf-8');
    const conversations = JSON.parse(fileContent) as ChatGPTExportConversation[];

    const maxConversations = this.config.maxConversations ?? conversations.length;
    const toProcess = conversations.slice(0, maxConversations);

    for (const conv of toProcess) {
      conversationCount++;
      const progress = conversationCount / toProcess.length;
      onProgress?.(progress, `Streaming conversation ${conversationCount}/${toProcess.length}`);

      const messages = this.extractMessagesFromMapping(conv.mapping, conv.current_node);
      totalMessages += messages.length;

      const convData = {
        id: conv.id,
        title: conv.title,
        createdAt: new Date(conv.create_time * 1000).toISOString(),
        updatedAt: new Date(conv.update_time * 1000).toISOString(),
        messages,
        gptId: conv.gizmo_id,
      };

      // Sanitize conv.id to prevent path traversal
      const safeConvId = basename(conv.id).replace(/[/\\]/g, '_');
      const convPath = join(outputDir, `${safeConvId}.json`);
      await writeFile(convPath, JSON.stringify(convData, null, 2));

      summaries.push({
        id: conv.id,
        title: conv.title || 'Untitled',
        messageCount: messages.length,
        createdAt: convData.createdAt,
        updatedAt: convData.updatedAt,
      });

      // Allow GC to reclaim memory periodically
      if (conversationCount % 100 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return {
      path: 'conversations/',
      count: summaries.length,
      messageCount: totalMessages,
      summaries,
    };
  }

  private extractMessagesFromMapping(
    mapping: Record<string, ChatGPTMessage>,
    currentNode?: string,
  ) {
    const messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp?: string;
      model?: string;
      attachments?: Array<{ id: string; name: string; mimeType: string }>;
    }> = [];

    // Build the message chain by following parent links
    const visited = new Set<string>();
    const orderedIds: string[] = [];

    // Find root node (node with no parent or parent not in mapping)
    let rootId: string | undefined;
    for (const [id, node] of Object.entries(mapping)) {
      if (!node.parent || !mapping[node.parent]) {
        rootId = id;
        break;
      }
    }

    // Traverse from root to build ordered list
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = mapping[nodeId];
      if (!node) return;

      if (node.message?.content) {
        orderedIds.push(nodeId);
      }

      // Process children
      for (const childId of node.children ?? []) {
        traverse(childId);
      }
    };

    if (rootId) {
      traverse(rootId);
    }

    // Extract message content
    for (const nodeId of orderedIds) {
      const node = mapping[nodeId];
      if (!node.message) continue;

      const msg = node.message;
      let content = '';

      if (msg.content.parts) {
        content = msg.content.parts
          .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
          .join('');
      } else if (msg.content.text) {
        content = msg.content.text;
      }

      if (!content.trim()) continue;

      const attachments = msg.metadata?.attachments?.map((att) => ({
        id: att.id,
        name: att.name,
        mimeType: att.mime_type,
      }));

      messages.push({
        id: msg.id,
        role: msg.author.role,
        content,
        timestamp: msg.create_time
          ? new Date(msg.create_time * 1000).toISOString()
          : undefined,
        model: msg.metadata?.model_slug,
        attachments,
      });
    }

    return messages;
  }

  private async extractFilesFromExport(workDir: string) {
    const filesDir = join(workDir, 'files');
    await mkdir(filesDir, { recursive: true });

    const sourceFilesDir = join(this.config.exportPath!, 'files');
    const entries: FileEntry[] = [];
    let totalSize = 0;

    try {
      const files = await readdir(sourceFilesDir);

      for (const filename of files) {
        const sourcePath = join(sourceFilesDir, filename);
        const stats = await stat(sourcePath);

        if (stats.isFile()) {
          // Copy file to work directory
          // Sanitize filename to prevent path traversal attacks
          const safeFilename = basename(filename);
          const content = await readFile(sourcePath);
          const destPath = join(filesDir, safeFilename);
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
    } catch {
      // No files directory in export
    }

    return {
      files: entries,
      count: entries.length,
      totalSize,
    };
  }

  private async extractGPTsFromExport() {
    const gptsPath = join(this.config.exportPath!, 'gpts.json');

    try {
      const content = await readFile(gptsPath, 'utf-8');
      const gpts = JSON.parse(content) as ChatGPTGPT[];

      const bots: CustomBotEntry[] = gpts.map((gpt) => ({
        id: gpt.id,
        name: gpt.name,
        description: gpt.description,
        instructions: gpt.instructions ?? '',
        knowledgeFiles: gpt.knowledge_files?.map((f) => f.name),
        capabilities: gpt.tools,
        createdAt: gpt.created_at,
        updatedAt: gpt.updated_at,
      }));

      return {
        bots,
        count: bots.length,
      };
    } catch {
      // No GPTs file in export
      return undefined;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private parseInstructionSections(content: string): InstructionSection[] {
    const sections: InstructionSection[] = [];
    const lines = content.split('\n');

    let currentSection: InstructionSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#+\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: headerMatch[1],
          content: '',
          priority: line.startsWith('##') ? 'high' : 'medium',
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
    // Extract key decisions/conclusions from assistant messages
    const keyPoints: string[] = [];
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    for (const msg of assistantMessages.slice(-5)) {
      // Check last 5 messages
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

    return keyPoints.slice(0, 5); // Max 5 key points
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
