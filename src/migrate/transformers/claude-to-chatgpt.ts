/**
 * Claude → ChatGPT Transformer
 *
 * Transforms a MigrationBundle from Claude format to ChatGPT format.
 *
 * Transformation Mappings:
 * | Source (Claude)        | Target (ChatGPT)      | Method                           |
 * |------------------------|-----------------------|----------------------------------|
 * | System Prompt          | Custom Instructions   | Truncate/prioritize if >1500ch   |
 * | Project Knowledge      | Memories + Files      | Split into discrete entries      |
 * | Artifacts              | Files                 | Export as documents              |
 * | Projects               | (Manual)              | Generate GPT config suggestions  |
 */

import { basename } from 'node:path';
import type {
  Platform,
  Transformer,
  TransformOptions,
  MigrationBundle,
  CompatibilityReport,
  CompatibilityItem,
  InstructionData,
  MemoryData,
  FileData,
  CustomBotData,
  ConversationData,
  MemoryEntry,
} from '../types.js';
import { getPlatformCapabilities } from '../capabilities.js';
import {
  getTargetLimits,
  intelligentTruncate,
  convertClaudeInstructionsToChatGPT,
  convertDocumentToMemories,
  splitContent,
  validateBundleForTarget,
} from './rules.js';

// ─── Claude to ChatGPT Transformer ───────────────────────────

export class ClaudeToChatGPTTransformer implements Transformer {
  readonly source: Platform = 'claude';
  readonly target: Platform = 'chatgpt';
  readonly version = '1.0.0';

  private progress = 0;

  /**
   * Analyze the bundle for compatibility without transforming.
   */
  async analyze(bundle: MigrationBundle): Promise<CompatibilityReport> {
    const items: CompatibilityItem[] = [];
    const recommendations: string[] = [];
    const targetCaps = getPlatformCapabilities('chatgpt');

    let perfect = 0;
    let adapted = 0;
    let incompatible = 0;

    // Analyze instructions (system prompt → custom instructions)
    if (bundle.contents.instructions) {
      const item = this.analyzeInstructions(bundle.contents.instructions, targetCaps.instructionLimit);
      items.push(item);
      if (item.status === 'perfect') perfect++;
      else if (item.status === 'adapted') adapted++;
      else incompatible++;
    }

    // Analyze memories/knowledge documents
    if (bundle.contents.memories && bundle.contents.memories.count > 0) {
      const item = this.analyzeMemories(bundle.contents.memories, targetCaps.memoryLimit!);
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

    // Analyze files (including artifacts)
    if (bundle.contents.files && bundle.contents.files.count > 0) {
      const fileItems = this.analyzeFiles(bundle.contents.files, targetCaps.fileSizeLimit!);
      for (const item of fileItems) {
        items.push(item);
        if (item.status === 'perfect') perfect++;
        else if (item.status === 'adapted') adapted++;
        else incompatible++;
      }
    }

    // Analyze projects (Claude doesn't have custom bots, but may have project configs)
    if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
      const item = this.analyzeProjects(bundle.contents.customBots);
      items.push(item);
      if (item.status === 'perfect') perfect++;
      else if (item.status === 'adapted') adapted++;
      else incompatible++;
    }

    // Generate recommendations
    if (bundle.contents.instructions && bundle.contents.instructions.length > 1500) {
      recommendations.push(
        'System prompt exceeds ChatGPT\'s 1500 character limit. Content will be prioritized and some may be lost.',
      );
      recommendations.push(
        'Consider creating a custom GPT for longer instructions, or store additional context as memories.',
      );
    }

    if (adapted > 0) {
      recommendations.push('Review adapted items after migration to ensure content meets expectations');
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
      source: 'claude',
      target: 'chatgpt',
      generatedAt: new Date().toISOString(),
      summary: { perfect, adapted, incompatible, total },
      items,
      recommendations,
      feasibility,
    };
  }

  /**
   * Transform the bundle for ChatGPT.
   */
  async transform(
    bundle: MigrationBundle,
    options: TransformOptions,
  ): Promise<MigrationBundle> {
    this.progress = 0;

    // Validate source
    if (bundle.source.platform !== 'claude') {
      throw new Error(`Expected Claude bundle, got ${bundle.source.platform}`);
    }

    // Validate target compatibility
    const validation = validateBundleForTarget(bundle, 'chatgpt');
    if (!validation.valid) {
      throw new Error(`Bundle validation failed: ${validation.errors.join(', ')}`);
    }

    const targetCaps = getPlatformCapabilities('chatgpt');
    const warnings: string[] = [...validation.warnings, ...bundle.metadata.warnings];
    const errors: string[] = [...bundle.metadata.errors];

    // Start transformation
    options.onProgress?.(0.05, 'Starting Claude → ChatGPT transformation...');

    // Transform instructions (system prompt → custom instructions) (25%)
    let transformedInstructions: InstructionData | undefined;
    let instructionOverflow: string | undefined;
    if (bundle.contents.instructions) {
      options.onProgress?.(0.1, 'Converting system prompt to custom instructions...');
      const result = await this.transformInstructions(
        bundle.contents.instructions,
        targetCaps.instructionLimit,
        options.overflowStrategy,
      );
      transformedInstructions = result.instructions;
      instructionOverflow = result.overflow;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 25;
    options.onProgress?.(0.25, 'Instructions converted');

    // Transform memories (may need to split large documents) (50%)
    let transformedMemories: MemoryData | undefined;
    if (bundle.contents.memories && bundle.contents.memories.count > 0) {
      options.onProgress?.(0.35, 'Converting knowledge to memories...');
      const result = this.transformMemories(
        bundle.contents.memories,
        targetCaps.memoryLimit!,
        instructionOverflow,
      );
      transformedMemories = result.memories;
      if (result.warnings.length > 0) warnings.push(...result.warnings);
    } else if (instructionOverflow) {
      // If we have overflow from instructions but no memories, create memories for the overflow
      options.onProgress?.(0.35, 'Creating memories for instruction overflow...');
      const result = this.createMemoriesFromOverflow(instructionOverflow, targetCaps.memoryLimit!);
      transformedMemories = result.memories;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 50;
    options.onProgress?.(0.5, 'Memories processed');

    // Transform conversations (limited support) (65%)
    let transformedConversations: ConversationData | undefined;
    if (bundle.contents.conversations) {
      options.onProgress?.(0.55, 'Processing conversations...');
      const result = this.transformConversations(bundle.contents.conversations);
      transformedConversations = result.conversations;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 65;
    options.onProgress?.(0.65, 'Conversations processed');

    // Transform files (including artifacts) (85%)
    let transformedFiles: FileData | undefined;
    if (bundle.contents.files && bundle.contents.files.count > 0) {
      options.onProgress?.(0.75, 'Processing files and artifacts...');
      const result = this.transformFiles(bundle.contents.files, targetCaps.fileSizeLimit!);
      transformedFiles = result.files;
      if (result.warnings.length > 0) warnings.push(...result.warnings);
    }
    this.progress = 85;
    options.onProgress?.(0.85, 'Files processed');

    // Transform projects to GPT suggestions (100%)
    let transformedBots: CustomBotData | undefined;
    if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
      options.onProgress?.(0.95, 'Generating GPT configuration suggestions...');
      const result = this.transformProjects(bundle.contents.customBots);
      transformedBots = result.bots;
      if (result.warning) warnings.push(result.warning);
    }
    this.progress = 100;
    options.onProgress?.(1.0, 'Transformation complete');

    // Build transformed bundle
    const transformed: MigrationBundle = {
      ...bundle,
      target: {
        platform: 'chatgpt',
        transformedAt: new Date().toISOString(),
        transformerVersion: this.version,
      },
      contents: {
        instructions: transformedInstructions,
        memories: transformedMemories,
        conversations: transformedConversations,
        files: transformedFiles,
        customBots: transformedBots,
        extras: {
          ...bundle.contents.extras,
          // Store instruction overflow for reference
          instructionOverflow: instructionOverflow ? { content: instructionOverflow } : undefined,
        },
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
        name: 'System Prompt → Custom Instructions',
        status: 'perfect',
        reason: `Within ChatGPT's ${limit} character limit (${len} chars)`,
      };
    }

    const overflowAmount = len - limit;
    const overflowPercent = Math.round((overflowAmount / len) * 100);

    return {
      type: 'instructions',
      name: 'System Prompt → Custom Instructions',
      status: 'adapted',
      reason: `Exceeds ChatGPT's limit by ${overflowAmount} chars (${overflowPercent}% overflow)`,
      action: 'Content will be prioritized; overflow may be converted to memories',
      sourceRef: `instructions:${len}`,
    };
  }

  private analyzeMemories(memories: MemoryData, limit: number): CompatibilityItem {
    const count = memories.count;

    if (count <= limit) {
      return {
        type: 'memory',
        name: 'Project Knowledge → Memories',
        status: 'perfect',
        reason: `${count} entries within ChatGPT's ${limit} memory limit`,
      };
    }

    return {
      type: 'memory',
      name: 'Project Knowledge → Memories',
      status: 'adapted',
      reason: `${count} entries exceed ChatGPT's ${limit} memory limit`,
      action: `Most recent/important ${limit} memories will be kept; rest saved as files`,
      sourceRef: `memories:${count}`,
    };
  }

  private analyzeConversations(conversations: ConversationData): CompatibilityItem {
    return {
      type: 'conversation',
      name: 'Conversation History',
      status: 'adapted',
      reason: 'ChatGPT conversation import not supported via API',
      action: 'Conversation history will be preserved in bundle for reference only',
      sourceRef: `conversations:${conversations.count}`,
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
          reason: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds ChatGPT's ${Math.round(sizeLimit / 1024 / 1024)}MB limit`,
          sourceRef: `file:${file.id}`,
        });
      }
    }

    if (perfectCount > 0) {
      items.unshift({
        type: 'file',
        name: `${perfectCount} Files (including Artifacts)`,
        status: 'perfect',
        reason: `${perfectCount} files within ChatGPT's size limit`,
      });
    }

    return items;
  }

  private analyzeProjects(bots: CustomBotData): CompatibilityItem {
    return {
      type: 'customBot',
      name: 'Claude Projects → GPT Configs',
      status: 'adapted',
      reason: 'Custom GPTs require manual creation through ChatGPT interface',
      action: `${bots.count} project configuration${bots.count > 1 ? 's' : ''} will be exported as GPT creation guides`,
      sourceRef: `projects:${bots.count}`,
    };
  }

  // ─── Transformation Helpers ──────────────────────────────

  private async transformInstructions(
    instructions: InstructionData,
    limit: number,
    overflowStrategy: TransformOptions['overflowStrategy'],
  ): Promise<{ instructions: InstructionData; overflow?: string; warning?: string }> {
    const content = instructions.content;

    // Check error strategy first
    if (content.length > limit && overflowStrategy === 'error') {
      throw new Error(
        `Instructions exceed limit (${content.length} > ${limit}) and overflow strategy is 'error'`,
      );
    }

    if (content.length <= limit) {
      // Still convert format even if within limit
      const { aboutUser, aboutModel } = convertClaudeInstructionsToChatGPT(content, limit);
      let finalContent: string;
      if (aboutUser && aboutModel) {
        finalContent = `## About Me\n${aboutUser}\n\n## How ChatGPT Should Respond\n${aboutModel}`;
      } else if (aboutUser) {
        finalContent = `## About Me\n${aboutUser}`;
      } else if (aboutModel) {
        finalContent = `## How ChatGPT Should Respond\n${aboutModel}`;
      } else {
        finalContent = content;
      }

      return {
        instructions: {
          content: finalContent,
          length: finalContent.length,
          sections: instructions.sections,
        },
      };
    }

    // Convert Claude format to ChatGPT format
    const { aboutUser, aboutModel, overflow } = convertClaudeInstructionsToChatGPT(content, limit);

    // Combine for ChatGPT custom instructions format
    let finalContent: string;
    if (aboutUser && aboutModel) {
      finalContent = `## About Me\n${aboutUser}\n\n## How ChatGPT Should Respond\n${aboutModel}`;
    } else if (aboutUser) {
      finalContent = `## About Me\n${aboutUser}`;
    } else if (aboutModel) {
      finalContent = `## How ChatGPT Should Respond\n${aboutModel}`;
    } else {
      finalContent = content.substring(0, limit);
    }

    // Additional truncation if still over limit
    if (finalContent.length > limit) {
      switch (overflowStrategy) {
        case 'truncate': {
          const result = intelligentTruncate(finalContent, limit);
          finalContent = result.content || finalContent.substring(0, limit);
          break;
        }
        case 'summarize':
        case 'split': {
          // Can't really split system instructions, so fall back to truncate
          const result = intelligentTruncate(finalContent, limit);
          finalContent = result.content || finalContent.substring(0, limit);
          break;
        }
        case 'error':
          // Already handled above
          break;
      }
    }

    const warning = overflow
      ? `System prompt exceeded limit. ${overflow.length} characters stored as overflow.`
      : undefined;

    return {
      instructions: {
        content: finalContent,
        length: finalContent.length,
        sections: instructions.sections,
      },
      overflow,
      warning,
    };
  }

  private transformMemories(
    memories: MemoryData,
    limit: number,
    instructionOverflow?: string,
  ): { memories: MemoryData; warnings: string[] } {
    const warnings: string[] = [];
    let entries = [...memories.entries];

    // Add instruction overflow as memories if present
    if (instructionOverflow) {
      const overflowMemories = this.createMemoryEntriesFromText(
        instructionOverflow,
        'Instruction Context',
      );
      entries = [...overflowMemories, ...entries];
      warnings.push(
        `${overflowMemories.length} memories created from instruction overflow`,
      );
    }

    // Respect memory limit
    if (entries.length > limit) {
      // Prioritize: instruction overflow first, then most recent
      const kept = entries.slice(0, limit);
      const dropped = entries.length - limit;
      warnings.push(
        `Memory limit exceeded. ${dropped} entries dropped (keeping ${limit} most important).`,
      );
      entries = kept;
    }

    // Ensure each entry fits within ChatGPT's per-memory limit (500 chars)
    const perMemoryLimit = 500;
    const processedEntries: MemoryEntry[] = [];

    for (const entry of entries) {
      if (entry.content.length <= perMemoryLimit) {
        processedEntries.push(entry);
      } else {
        // Split long entries
        const chunks = splitContent(entry.content, perMemoryLimit - 50); // Leave room for context
        for (let i = 0; i < chunks.length; i++) {
          processedEntries.push({
            ...entry,
            id: `${entry.id}_part${i + 1}`,
            content: chunks.length > 1 ? `[Part ${i + 1}/${chunks.length}] ${chunks[i]}` : chunks[i],
          });
        }
      }
    }

    // Re-check limit after splitting
    const finalEntries =
      processedEntries.length > limit ? processedEntries.slice(0, limit) : processedEntries;

    if (processedEntries.length > limit) {
      warnings.push(
        `After splitting long entries, ${processedEntries.length - limit} additional entries were dropped`,
      );
    }

    return {
      memories: {
        entries: finalEntries,
        count: finalEntries.length,
      },
      warnings,
    };
  }

  private createMemoriesFromOverflow(
    overflow: string,
    limit: number,
  ): { memories: MemoryData; warning?: string } {
    const entries = this.createMemoryEntriesFromText(overflow, 'System Context');
    const finalEntries = entries.slice(0, limit);

    return {
      memories: {
        entries: finalEntries,
        count: finalEntries.length,
      },
      warning:
        entries.length > limit
          ? `${entries.length - limit} overflow memories dropped due to limit`
          : undefined,
    };
  }

  private createMemoryEntriesFromText(text: string, category: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const timestamp = new Date().toISOString();

    // Try to split by paragraphs first
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      if (para.length > 0) {
        entries.push({
          id: `overflow_${i + 1}_${Date.now()}`,
          content: para,
          createdAt: timestamp,
          category,
          source: 'claude-migration',
        });
      }
    }

    return entries;
  }

  private transformConversations(
    conversations: ConversationData,
  ): { conversations: ConversationData; warning?: string } {
    // Conversations can't be imported to ChatGPT via API
    // Just preserve the data for reference
    return {
      conversations,
      warning:
        'Conversation history preserved but cannot be automatically imported to ChatGPT',
    };
  }

  private transformFiles(
    files: FileData,
    sizeLimit: number,
  ): { files: FileData; warnings: string[] } {
    const warnings: string[] = [];
    const validFiles = files.files.filter((f) => {
      if (f.size > sizeLimit) {
        warnings.push(
          `File "${basename(f.filename)}" (${Math.round(f.size / 1024 / 1024)}MB) exceeds ChatGPT's limit and will be skipped`,
        );
        return false;
      }
      return true;
    });

    return {
      files: {
        files: validFiles.map((f) => ({
          ...f,
          filename: basename(f.filename),
        })),
        count: validFiles.length,
        totalSize: validFiles.reduce((sum, f) => sum + f.size, 0),
      },
      warnings,
    };
  }

  private transformProjects(
    bots: CustomBotData,
  ): { bots: CustomBotData; warning?: string } {
    // Claude projects → GPT configuration suggestions
    // The actual GPT creation must be done manually

    const transformedBots = bots.bots.map((project) => ({
      ...project,
      // Add note about manual creation
      description: `[Migrate to GPT] ${project.description || project.name}\n\nInstructions:\n${project.instructions.substring(0, 500)}${project.instructions.length > 500 ? '...' : ''}`,
    }));

    return {
      bots: {
        bots: transformedBots,
        count: transformedBots.length,
      },
      warning: `${bots.count} Claude project${bots.count > 1 ? 's' : ''} exported as GPT configuration guides. Manual GPT creation required.`,
    };
  }
}
