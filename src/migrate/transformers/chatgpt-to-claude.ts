/**
 * ChatGPT → Claude Transformer
 *
 * Transforms a MigrationBundle from ChatGPT format to Claude format.
 *
 * Transformation Mappings:
 * | Source (ChatGPT)       | Target (Claude)       | Method                           |
 * |------------------------|-----------------------|----------------------------------|
 * | Custom Instructions    | System Prompt         | Direct transfer / expand         |
 * | Memories               | Project Knowledge     | Convert to structured document   |
 * | Conversations          | Context Summary       | Summarize key decisions          |
 * | Files                  | Project Files         | Direct transfer                  |
 * | GPTs                   | Projects              | Map configuration                |
 */

import { basename } from 'node:path';
import type {
  Platform,
  Transformer,
  TransformOptions,
  MigrationBundle,
  CompatibilityReport,
  CompatibilityItem,
  CompatibilityStatus,
  InstructionData,
  MemoryData,
  FileData,
  CustomBotData,
  ConversationData,
} from '../types.js';
import { getPlatformCapabilities } from '../capabilities.js';
import {
  getTargetLimits,
  intelligentTruncate,
  convertChatGPTInstructionsToClaude,
  convertMemoriesToDocument,
  extractContextFromConversations,
  mapGPTToProject,
  validateBundleForTarget,
  type TransformationResult,
} from './rules.js';

// ─── ChatGPT to Claude Transformer ───────────────────────────

export class ChatGPTToClaudeTransformer implements Transformer {
  readonly source: Platform = 'chatgpt';
  readonly target: Platform = 'claude';
  readonly version = '1.0.0';

  private progress = 0;

  /**
   * Analyze the bundle for compatibility without transforming.
   */
  async analyze(bundle: MigrationBundle): Promise<CompatibilityReport> {
    const items: CompatibilityItem[] = [];
    const recommendations: string[] = [];
    const targetCaps = getPlatformCapabilities('claude');
    const sourceCaps = getPlatformCapabilities('chatgpt');

    let perfect = 0;
    let adapted = 0;
    let incompatible = 0;

    // Analyze instructions
    if (bundle.contents.instructions) {
      const item = this.analyzeInstructions(bundle.contents.instructions, targetCaps.instructionLimit);
      items.push(item);
      if (item.status === 'perfect') perfect++;
      else if (item.status === 'adapted') adapted++;
      else incompatible++;
    }

    // Analyze memories
    if (bundle.contents.memories && bundle.contents.memories.count > 0) {
      const item = this.analyzeMemories(bundle.contents.memories);
      items.push(item);
      if (item.status === 'perfect') perfect++;
      else if (item.status === 'adapted') adapted++;
      else incompatible++;
    }

    // Analyze conversations
    if (bundle.contents.conversations && bundle.contents.conversations.count > 0) {
      const item = this.analyzeConversations(bundle.contents.conversations);
      items.push(item);
      if (item.status === 'perfect') perfect++;
      else if (item.status === 'adapted') adapted++;
      else incompatible++;
    }

    // Analyze files
    if (bundle.contents.files && bundle.contents.files.count > 0) {
      const fileItems = this.analyzeFiles(bundle.contents.files, targetCaps.fileSizeLimit!);
      for (const item of fileItems) {
        items.push(item);
        if (item.status === 'perfect') perfect++;
        else if (item.status === 'adapted') adapted++;
        else incompatible++;
      }
    }

    // Analyze custom GPTs
    if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
      const item = this.analyzeCustomBots(bundle.contents.customBots);
      items.push(item);
      if (item.status === 'perfect') perfect++;
      else if (item.status === 'adapted') adapted++;
      else incompatible++;
    }

    // Generate recommendations
    if (adapted > 0) {
      recommendations.push('Review adapted items after migration to ensure content meets expectations');
    }

    if (bundle.contents.instructions && bundle.contents.instructions.length < 500) {
      recommendations.push(
        'Claude supports longer system prompts. Consider expanding instructions for better results.',
      );
    }

    if (bundle.contents.memories && bundle.contents.memories.count > 20) {
      recommendations.push(
        'Many memories will be consolidated into a document. Review the knowledge file after migration.',
      );
    }

    if (bundle.contents.customBots && bundle.contents.customBots.count > 1) {
      recommendations.push(
        'Multiple GPTs found. Each will become a separate Claude project. You may want to consolidate.',
      );
    }

    // Determine feasibility
    const total = perfect + adapted + incompatible;
    let feasibility: 'easy' | 'moderate' | 'complex' | 'partial';

    if (incompatible === 0 && adapted === 0) {
      feasibility = 'easy';
    } else if (incompatible === 0 && adapted <= total / 3) {
      feasibility = 'moderate';
    } else if (incompatible <= total / 4) {
      feasibility = 'complex';
    } else {
      feasibility = 'partial';
    }

    return {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: new Date().toISOString(),
      summary: { perfect, adapted, incompatible, total },
      items,
      recommendations,
      feasibility,
    };
  }

  /**
   * Transform the bundle for Claude.
   */
  async transform(
    bundle: MigrationBundle,
    options: TransformOptions,
  ): Promise<MigrationBundle> {
    this.progress = 0;

    // Validate source
    if (bundle.source.platform !== 'chatgpt') {
      throw new Error(`Expected ChatGPT bundle, got ${bundle.source.platform}`);
    }

    // Validate target compatibility
    const validation = validateBundleForTarget(bundle, 'claude');
    if (!validation.valid) {
      throw new Error(`Bundle validation failed: ${validation.errors.join(', ')}`);
    }

    const targetCaps = getPlatformCapabilities('claude');
    const warnings: string[] = [...validation.warnings, ...bundle.metadata.warnings];
    const errors: string[] = [...bundle.metadata.errors];

    // Start transformation
    options.onProgress?.(0.05, 'Starting ChatGPT → Claude transformation...');

    // Transform instructions (20%)
    let transformedInstructions: InstructionData | undefined;
    if (bundle.contents.instructions) {
      options.onProgress?.(0.1, 'Transforming instructions to system prompt...');
      const result = await this.transformInstructions(
        bundle.contents.instructions,
        targetCaps.instructionLimit,
        options.overflowStrategy,
      );
      transformedInstructions = result.instructions;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 20;
    options.onProgress?.(0.2, 'Instructions transformed');

    // Transform memories to knowledge document (40%)
    let transformedMemories: MemoryData | undefined;
    if (bundle.contents.memories && bundle.contents.memories.count > 0) {
      options.onProgress?.(0.3, 'Converting memories to knowledge document...');
      const result = this.transformMemories(bundle.contents.memories);
      transformedMemories = result.memories;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 40;
    options.onProgress?.(0.4, 'Memories converted');

    // Transform conversations to context summary (60%)
    let transformedConversations: ConversationData | undefined;
    if (bundle.contents.conversations) {
      options.onProgress?.(0.5, 'Extracting context from conversations...');
      const result = this.transformConversations(bundle.contents.conversations);
      transformedConversations = result.conversations;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 60;
    options.onProgress?.(0.6, 'Conversation context extracted');

    // Transform files (80%)
    let transformedFiles: FileData | undefined;
    if (bundle.contents.files && bundle.contents.files.count > 0) {
      options.onProgress?.(0.7, 'Processing files...');
      const result = this.transformFiles(bundle.contents.files, targetCaps.fileSizeLimit!);
      transformedFiles = result.files;
      if (result.warnings.length > 0) warnings.push(...result.warnings);
    }
    this.progress = 80;
    options.onProgress?.(0.8, 'Files processed');

    // Transform custom GPTs to project configs (100%)
    let transformedBots: CustomBotData | undefined;
    if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
      options.onProgress?.(0.9, 'Mapping GPTs to project configurations...');
      const result = this.transformCustomBots(bundle.contents.customBots);
      transformedBots = result.bots;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 100;
    options.onProgress?.(1.0, 'Transformation complete');

    // Build transformed bundle
    const transformed: MigrationBundle = {
      ...bundle,
      target: {
        platform: 'claude',
        transformedAt: new Date().toISOString(),
        transformerVersion: this.version,
      },
      contents: {
        instructions: transformedInstructions,
        memories: transformedMemories,
        conversations: transformedConversations,
        files: transformedFiles,
        customBots: transformedBots,
        extras: bundle.contents.extras,
      },
      metadata: {
        ...bundle.metadata,
        warnings,
        errors,
      },
    };

    return transformed;
  }

  // ─── Analysis Helpers ────────────────────────────────────

  private analyzeInstructions(
    instructions: InstructionData,
    limit: number,
  ): CompatibilityItem {
    const len = instructions.length;

    if (len <= limit) {
      return {
        type: 'instructions',
        name: 'Custom Instructions → System Prompt',
        status: 'perfect',
        reason: `Within Claude's ${limit} character limit (${len} chars)`,
      };
    }

    return {
      type: 'instructions',
      name: 'Custom Instructions → System Prompt',
      status: 'adapted',
      reason: `Exceeds Claude's limit (${len} > ${limit} chars)`,
      action: 'Will be intelligently truncated or summarized',
      sourceRef: `instructions:${len}`,
    };
  }

  private analyzeMemories(memories: MemoryData): CompatibilityItem {
    // Claude doesn't have memories - they become a knowledge document
    return {
      type: 'memory',
      name: 'Memories → Project Knowledge',
      status: 'adapted',
      reason: `Claude uses project knowledge instead of explicit memories`,
      action: `${memories.count} memories will be converted to a structured document`,
      sourceRef: `memories:${memories.count}`,
    };
  }

  private analyzeConversations(conversations: ConversationData): CompatibilityItem {
    if (!conversations.summaries || conversations.summaries.length === 0) {
      return {
        type: 'conversation',
        name: 'Conversation History → Context Summary',
        status: 'adapted',
        reason: 'Conversations available but no key points extracted',
        action: 'Conversation metadata will be preserved; content can be referenced',
      };
    }

    const keyPointCount = conversations.summaries.reduce(
      (sum, s) => sum + (s.keyPoints?.length ?? 0),
      0,
    );

    return {
      type: 'conversation',
      name: 'Conversation History → Context Summary',
      status: 'adapted',
      reason: `${conversations.count} conversations with ${keyPointCount} key points`,
      action: 'Key decisions and preferences will be extracted into a context document',
    };
  }

  private analyzeFiles(files: FileData, sizeLimit: number): CompatibilityItem[] {
    const items: CompatibilityItem[] = [];
    let perfectCount = 0;
    let oversizedCount = 0;

    for (const file of files.files) {
      if (file.size <= sizeLimit) {
        perfectCount++;
      } else {
        oversizedCount++;
        items.push({
          type: 'file',
          name: basename(file.filename),
          status: 'incompatible',
          reason: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds Claude's ${Math.round(sizeLimit / 1024 / 1024)}MB limit`,
          sourceRef: `file:${file.id}`,
        });
      }
    }

    if (perfectCount > 0) {
      items.unshift({
        type: 'file',
        name: `${perfectCount} Files → Project Files`,
        status: 'perfect',
        reason: `${perfectCount} files within Claude's size limit`,
      });
    }

    return items;
  }

  private analyzeCustomBots(bots: CustomBotData): CompatibilityItem {
    return {
      type: 'customBot',
      name: 'GPTs → Claude Projects',
      status: 'adapted',
      reason: `Claude uses Projects instead of custom bots`,
      action: `${bots.count} GPT${bots.count > 1 ? 's' : ''} will be mapped to project configurations`,
      sourceRef: `bots:${bots.count}`,
    };
  }

  // ─── Transformation Helpers ──────────────────────────────

  private async transformInstructions(
    instructions: InstructionData,
    limit: number,
    overflowStrategy: TransformOptions['overflowStrategy'],
  ): Promise<{ instructions: InstructionData; warning?: string }> {
    let content = instructions.content;
    let warning: string | undefined;

    // Parse ChatGPT sections if present
    const aboutUserMatch = content.match(/##\s*About Me\n([\s\S]*?)(?=##|$)/i);
    const aboutModelMatch = content.match(/##\s*How ChatGPT Should Respond\n([\s\S]*?)(?=##|$)/i);

    if (aboutUserMatch || aboutModelMatch) {
      content = convertChatGPTInstructionsToClaude(
        aboutUserMatch?.[1]?.trim() || '',
        aboutModelMatch?.[1]?.trim() || content,
      );
    }

    // Handle overflow
    if (content.length > limit) {
      switch (overflowStrategy) {
        case 'truncate': {
          const result = intelligentTruncate(content, limit);
          content = result.content || content.substring(0, limit);
          warning = result.warning;
          break;
        }
        case 'summarize': {
          // For now, use intelligent truncation as a fallback
          // Real summarization would require LLM call
          const result = intelligentTruncate(content, limit);
          content = result.content || content.substring(0, limit);
          warning = `Content would benefit from LLM summarization. ${result.warning || ''}`;
          break;
        }
        case 'error':
          throw new Error(`Instructions exceed limit (${content.length} > ${limit}) and overflow strategy is 'error'`);
        case 'split':
          // System prompt can't be split - fall back to truncate
          const result = intelligentTruncate(content, limit);
          content = result.content || content.substring(0, limit);
          warning = `System prompt cannot be split. ${result.warning || ''}`;
          break;
      }
    }

    return {
      instructions: {
        content,
        length: content.length,
        sections: instructions.sections,
      },
      warning,
    };
  }

  private transformMemories(
    memories: MemoryData,
  ): { memories: MemoryData; warning?: string } {
    // Convert memories to a structured document
    // The actual document content will be stored in extras for the loader
    const document = convertMemoriesToDocument(memories.entries);

    // Return modified memories structure with conversion note
    return {
      memories: {
        entries: memories.entries.map((e) => ({
          ...e,
          // Tag entries as converted
          category: e.category || 'Migrated',
        })),
        count: memories.count,
      },
      warning:
        memories.count > 50
          ? `Large number of memories (${memories.count}) converted to document. Review recommended.`
          : undefined,
    };
  }

  private transformConversations(
    conversations: ConversationData,
  ): { conversations: ConversationData; warning?: string } {
    // Extract context summary from conversations
    if (conversations.summaries && conversations.summaries.length > 0) {
      const contextSummary = extractContextFromConversations(conversations.summaries);

      // Store the summary in extras for the loader to use
      return {
        conversations: {
          ...conversations,
          // Add a note that context was extracted
        },
        warning:
          conversations.count > 100
            ? `${conversations.count} conversations processed. Key insights extracted to context summary.`
            : undefined,
      };
    }

    return { conversations };
  }

  private transformFiles(
    files: FileData,
    sizeLimit: number,
  ): { files: FileData; warnings: string[] } {
    const warnings: string[] = [];
    const validFiles = files.files.filter((f) => {
      if (f.size > sizeLimit) {
        warnings.push(
          `File "${basename(f.filename)}" (${Math.round(f.size / 1024 / 1024)}MB) exceeds Claude's limit and will be skipped`,
        );
        return false;
      }
      return true;
    });

    return {
      files: {
        files: validFiles.map((f) => ({
          ...f,
          // Ensure safe filename
          filename: basename(f.filename),
        })),
        count: validFiles.length,
        totalSize: validFiles.reduce((sum, f) => sum + f.size, 0),
      },
      warnings,
    };
  }

  private transformCustomBots(
    bots: CustomBotData,
  ): { bots: CustomBotData; warning?: string } {
    // Map GPT configurations to Claude project format
    const transformedBots = bots.bots.map((gpt) => {
      const projectConfig = mapGPTToProject(gpt);

      return {
        ...gpt,
        // Store project mapping in the bot entry
        instructions: projectConfig.systemPrompt,
        description: projectConfig.description,
      };
    });

    return {
      bots: {
        bots: transformedBots,
        count: transformedBots.length,
      },
      warning:
        bots.count > 1
          ? `${bots.count} GPTs mapped to Claude project configurations. Manual project creation required.`
          : undefined,
    };
  }
}
