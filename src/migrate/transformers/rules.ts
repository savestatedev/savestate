/**
 * Transformation Rule Schema
 *
 * Defines the structure and utilities for platform-to-platform data transformation.
 * Rules specify how to convert data types between different AI assistant platforms,
 * handling format differences, character limits, and feature disparities.
 */

import type { Platform, MigrationBundle } from '../types.js';
import { getPlatformCapabilities } from '../capabilities.js';

// ─── Rule Types ──────────────────────────────────────────────

/**
 * Content type categories that can be transformed.
 */
export type ContentType =
  | 'instructions'
  | 'memories'
  | 'conversations'
  | 'files'
  | 'customBots';

/**
 * Transformation strategy when content exceeds target limits.
 */
export type OverflowStrategy = 'truncate' | 'summarize' | 'split' | 'error';

/**
 * How content is adapted between platforms.
 */
export type AdaptationMethod =
  | 'direct'         // Direct transfer, no changes
  | 'expand'         // Expand to fill available space
  | 'truncate'       // Cut to fit limit
  | 'summarize'      // Use LLM to condense
  | 'split'          // Split across multiple targets
  | 'convert'        // Convert format (e.g., memories → document)
  | 'merge'          // Merge multiple sources into one target
  | 'skip';          // Cannot be migrated, skip

/**
 * A single transformation rule.
 */
export interface TransformationRule {
  /** Source content type */
  sourceType: ContentType;
  /** Target content type (may differ from source) */
  targetType: ContentType | ContentType[];
  /** How the content is adapted */
  method: AdaptationMethod;
  /** Optional transformation function name */
  transformer?: string;
  /** Priority for this rule (higher = applied first) */
  priority: number;
  /** Description of what this rule does */
  description: string;
  /** Conditions for applying this rule */
  conditions?: RuleCondition[];
}

/**
 * Condition for when a rule applies.
 */
export interface RuleCondition {
  /** Type of condition */
  type: 'length' | 'exists' | 'count' | 'capability' | 'custom';
  /** What to check */
  field?: string;
  /** Comparison operator */
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'exists' | 'notExists';
  /** Value to compare against */
  value?: number | string | boolean;
  /** Platform capability to check */
  capability?: string;
}

/**
 * Result of applying a transformation rule.
 */
export interface TransformationResult {
  /** Whether transformation succeeded */
  success: boolean;
  /** Transformed content (if applicable) */
  content?: string;
  /** Additional data (for split results, etc.) */
  data?: unknown;
  /** Warning message (if partially successful) */
  warning?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether user review is recommended */
  needsReview?: boolean;
}

/**
 * Character limit specification for a content type.
 */
export interface CharacterLimit {
  /** Hard limit (content will be cut/rejected if exceeded) */
  hard: number;
  /** Soft limit (warning issued if exceeded) */
  soft?: number;
  /** What to do when hard limit is exceeded */
  overflowStrategy: OverflowStrategy;
}

/**
 * Platform transformation mapping.
 */
export interface PlatformMapping {
  source: Platform;
  target: Platform;
  rules: TransformationRule[];
  limits: Record<ContentType, CharacterLimit | null>;
}

// ─── Character Limits by Platform ────────────────────────────

/**
 * Get character limits for a target platform.
 */
export function getTargetLimits(target: Platform): Record<ContentType, CharacterLimit | null> {
  const caps = getPlatformCapabilities(target);

  switch (target) {
    case 'claude':
      return {
        instructions: {
          hard: caps.instructionLimit,
          soft: caps.instructionLimit * 0.9,
          overflowStrategy: 'summarize',
        },
        memories: null, // Claude doesn't have explicit memories - converted to docs
        conversations: null, // Stored as context summary
        files: {
          hard: caps.fileSizeLimit ?? 32 * 1024 * 1024,
          overflowStrategy: 'error',
        },
        customBots: null, // Mapped to projects
      };

    case 'chatgpt':
      return {
        instructions: {
          hard: caps.instructionLimit,
          soft: 1200, // Leave buffer for safety
          overflowStrategy: 'truncate',
        },
        memories: {
          hard: 500, // Per memory entry
          soft: 400,
          overflowStrategy: 'split',
        },
        conversations: null, // Not writeable via API
        files: {
          hard: caps.fileSizeLimit ?? 512 * 1024 * 1024,
          overflowStrategy: 'error',
        },
        customBots: null, // GPTs require manual creation
      };

    case 'gemini':
      return {
        instructions: {
          hard: caps.instructionLimit,
          soft: 3500,
          overflowStrategy: 'truncate',
        },
        memories: {
          hard: 300,
          soft: 250,
          overflowStrategy: 'split',
        },
        conversations: null,
        files: {
          hard: caps.fileSizeLimit ?? 20 * 1024 * 1024,
          overflowStrategy: 'error',
        },
        customBots: null,
      };

    case 'copilot':
      return {
        instructions: {
          hard: caps.instructionLimit,
          soft: 1800,
          overflowStrategy: 'truncate',
        },
        memories: {
          hard: 300,
          soft: 250,
          overflowStrategy: 'split',
        },
        conversations: null,
        files: {
          hard: caps.fileSizeLimit ?? 10 * 1024 * 1024,
          overflowStrategy: 'error',
        },
        customBots: null,
      };

    default:
      throw new Error(`Unknown platform: ${target}`);
  }
}

// ─── Content Truncation & Summarization ──────────────────────

/**
 * Intelligently truncate content while preserving meaning.
 * Tries to remove less important parts first.
 */
export function intelligentTruncate(content: string, limit: number): TransformationResult {
  if (content.length <= limit) {
    return { success: true, content };
  }

  // Strategy 1: Remove examples (often verbose)
  const withoutExamples = removeExamples(content);
  if (withoutExamples.length <= limit) {
    return {
      success: true,
      content: withoutExamples,
      warning: 'Examples removed to fit character limit',
    };
  }

  // Strategy 2: Remove verbose sections (like "Note:" blocks)
  const withoutNotes = removeVerboseSections(withoutExamples);
  if (withoutNotes.length <= limit) {
    return {
      success: true,
      content: withoutNotes,
      warning: 'Verbose sections removed to fit character limit',
    };
  }

  // Strategy 3: Condense numbered/bulleted lists
  const condensedLists = condenseLists(withoutNotes);
  if (condensedLists.length <= limit) {
    return {
      success: true,
      content: condensedLists,
      warning: 'Lists condensed to fit character limit',
    };
  }

  // Strategy 4: Hard truncate at sentence boundary
  const truncated = truncateAtSentence(condensedLists, limit - 3);
  return {
    success: true,
    content: truncated + '...',
    warning: `Content truncated from ${content.length} to ${limit} characters`,
    needsReview: true,
  };
}

/**
 * Remove example blocks from content.
 */
function removeExamples(content: string): string {
  // Remove code block examples
  let result = content.replace(/```[\s\S]*?```/g, '');

  // Remove "Example:" or "For example:" sections
  result = result.replace(/(?:Example|For example|e\.g\.|i\.e\.)[:\s]*[^\n]+(?:\n(?![A-Z#\-\d]).*?)*/gi, '');

  // Clean up extra whitespace
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Remove verbose sections like notes and warnings.
 */
function removeVerboseSections(content: string): string {
  // Remove "Note:" blocks
  let result = content.replace(/(?:Note|Warning|Tip|Important)[:\s]*[^\n]+(?:\n(?![A-Z#\-\d]).*?)*/gi, '');

  // Remove parenthetical asides
  result = result.replace(/\s*\([^)]{50,}\)/g, '');

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Condense bulleted/numbered lists.
 */
function condenseLists(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let consecutiveListItems = 0;

  for (const line of lines) {
    const isListItem = /^[\s]*[-*•\d.]+[\s]/.test(line);

    if (isListItem) {
      consecutiveListItems++;
      // Keep first 5 items of any list
      if (consecutiveListItems <= 5) {
        result.push(line);
      } else if (consecutiveListItems === 6) {
        result.push('  - (and more...)');
      }
    } else {
      consecutiveListItems = 0;
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

/**
 * Truncate at a sentence boundary.
 */
function truncateAtSentence(content: string, limit: number): string {
  if (content.length <= limit) return content;

  // Find the last sentence boundary before the limit
  const truncated = content.substring(0, limit);
  const lastSentence = truncated.search(/[.!?]\s[A-Z][^.!?]*$/);

  if (lastSentence > limit * 0.7) {
    return truncated.substring(0, lastSentence + 1).trim();
  }

  // Fall back to last complete word
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > limit * 0.8) {
    return truncated.substring(0, lastSpace).trim();
  }

  return truncated.trim();
}

// ─── Content Splitting ───────────────────────────────────────

/**
 * Split content into multiple chunks that fit within a limit.
 */
export function splitContent(content: string, limit: number): string[] {
  if (content.length <= limit) {
    return [content];
  }

  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);

  let currentChunk = '';

  for (const para of paragraphs) {
    // If adding this paragraph exceeds limit
    if ((currentChunk + '\n\n' + para).length > limit) {
      // Save current chunk if non-empty
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      // If single paragraph exceeds limit, split it
      if (para.length > limit) {
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [];

        // If no sentences found (no punctuation), split by characters
        if (sentences.length === 0) {
          // Split long content without natural breaks into fixed-size chunks
          let remaining = para;
          while (remaining.length > limit) {
            chunks.push(remaining.substring(0, limit));
            remaining = remaining.substring(limit);
          }
          currentChunk = remaining;
        } else {
          currentChunk = '';
          for (const sentence of sentences) {
            if ((currentChunk + ' ' + sentence).length > limit) {
              if (currentChunk) chunks.push(currentChunk.trim());
              // If single sentence exceeds limit, split it by characters
              if (sentence.length > limit) {
                let remaining = sentence;
                while (remaining.length > limit) {
                  chunks.push(remaining.substring(0, limit));
                  remaining = remaining.substring(limit);
                }
                currentChunk = remaining;
              } else {
                currentChunk = sentence;
              }
            } else {
              currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
          }
        }
      } else {
        currentChunk = para;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ─── Format Conversion ───────────────────────────────────────

/**
 * Convert ChatGPT-style custom instructions to Claude system prompt format.
 * ChatGPT splits into "About Me" and "How to Respond" sections.
 */
export function convertChatGPTInstructionsToClaude(
  aboutUser: string,
  aboutModel: string,
): string {
  const sections: string[] = [];

  if (aboutUser) {
    sections.push(`# User Context\n\n${aboutUser}`);
  }

  if (aboutModel) {
    sections.push(`# Response Guidelines\n\n${aboutModel}`);
  }

  return sections.join('\n\n');
}

/**
 * Convert Claude system prompt to ChatGPT custom instructions.
 * Must fit within 1500 character limit.
 */
export function convertClaudeInstructionsToChatGPT(
  systemPrompt: string,
  limit: number = 1500,
): { aboutUser: string; aboutModel: string; overflow?: string } {
  // Try to detect sections
  const userContextMatch = systemPrompt.match(
    /(?:^|\n)#*\s*(?:User Context|About (?:the )?User|Background)[:\s]*\n*([\s\S]*?)(?=\n#|\n*$)/i,
  );
  const responseMatch = systemPrompt.match(
    /(?:^|\n)#*\s*(?:Response Guidelines?|How to Respond|Instructions?|Guidelines?)[:\s]*\n*([\s\S]*?)(?=\n#|\n*$)/i,
  );

  let aboutUser = userContextMatch?.[1]?.trim() || '';
  let aboutModel = responseMatch?.[1]?.trim() || systemPrompt.trim();

  // If no clear sections, put everything in aboutModel
  if (!userContextMatch && !responseMatch) {
    aboutModel = systemPrompt.trim();
    aboutUser = '';
  }

  // Handle overflow
  const halfLimit = Math.floor(limit / 2);
  let overflow: string | undefined;

  if (aboutUser.length > halfLimit) {
    const result = intelligentTruncate(aboutUser, halfLimit);
    overflow = aboutUser.substring(halfLimit);
    aboutUser = result.content || aboutUser.substring(0, halfLimit);
  }

  if (aboutModel.length > halfLimit) {
    const result = intelligentTruncate(aboutModel, halfLimit);
    overflow = (overflow ? overflow + '\n\n' : '') + aboutModel.substring(halfLimit);
    aboutModel = result.content || aboutModel.substring(0, halfLimit);
  }

  // Rebalance if one section has room
  const totalUsed = aboutUser.length + aboutModel.length;
  if (totalUsed < limit && overflow) {
    const available = limit - totalUsed - 10;
    if (available > 0) {
      aboutModel += '\n\n' + overflow.substring(0, available);
      overflow = overflow.length > available ? overflow.substring(available) : undefined;
    }
  }

  return { aboutUser, aboutModel, overflow };
}

/**
 * Convert memory entries to a structured document.
 */
export function convertMemoriesToDocument(
  memories: Array<{ id: string; content: string; createdAt: string; category?: string }>,
): string {
  const lines: string[] = [
    '# User Memories',
    '',
    '> This document contains memories extracted from your previous AI assistant.',
    '> Use this context to personalize responses and maintain continuity.',
    '',
  ];

  // Group by category
  const byCategory = new Map<string, typeof memories>();
  for (const memory of memories) {
    const category = memory.category || 'General';
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(memory);
  }

  // Sort categories by count (most entries first)
  const sortedCategories = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [category, items] of sortedCategories) {
    lines.push(`## ${category}`, '');
    for (const item of items) {
      lines.push(`- ${item.content}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Split a document back into discrete memory entries.
 */
export function convertDocumentToMemories(
  document: string,
): Array<{ content: string; category: string }> {
  const memories: Array<{ content: string; category: string }> = [];
  const lines = document.split('\n');

  let currentCategory = 'General';

  for (const line of lines) {
    // Check for category header
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      currentCategory = headerMatch[1].trim();
      continue;
    }

    // Check for bullet point
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)$/);
    if (bulletMatch) {
      memories.push({
        content: bulletMatch[1].trim(),
        category: currentCategory,
      });
    }
  }

  return memories;
}

/**
 * Extract key decisions and preferences from conversation summaries.
 */
export function extractContextFromConversations(
  summaries: Array<{ title: string; keyPoints?: string[] }>,
): string {
  const lines: string[] = [
    '# Conversation Insights',
    '',
    '> Key decisions and preferences extracted from conversation history.',
    '',
  ];

  const allKeyPoints: string[] = [];

  for (const summary of summaries) {
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      for (const point of summary.keyPoints) {
        if (!allKeyPoints.includes(point)) {
          allKeyPoints.push(point);
        }
      }
    }
  }

  if (allKeyPoints.length > 0) {
    lines.push('## Key Decisions & Preferences', '');
    for (const point of allKeyPoints.slice(0, 20)) {
      // Limit to 20 key points
      lines.push(`- ${point}`);
    }
  } else {
    lines.push(
      '*No key decisions or preferences were extracted from conversations.*',
      '',
      `Reviewed ${summaries.length} conversation${summaries.length === 1 ? '' : 's'}.`,
    );
  }

  return lines.join('\n');
}

/**
 * Map a GPT configuration to Claude project settings.
 */
export function mapGPTToProject(gpt: {
  name: string;
  description?: string;
  instructions: string;
  knowledgeFiles?: string[];
  capabilities?: string[];
}): {
  projectName: string;
  description: string;
  systemPrompt: string;
  knowledgeDocs: Array<{ name: string; content: string }>;
} {
  const systemPrompt = [
    gpt.instructions,
    gpt.capabilities?.length
      ? `\n\n## Capabilities\nThis assistant can: ${gpt.capabilities.join(', ')}`
      : '',
  ].join('');

  return {
    projectName: gpt.name,
    description: gpt.description || `Migrated from GPT: ${gpt.name}`,
    systemPrompt,
    knowledgeDocs: [], // Files will be handled separately
  };
}

// ─── Validation ──────────────────────────────────────────────

/**
 * Validate that a bundle can be transformed to the target platform.
 */
export function validateBundleForTarget(
  bundle: MigrationBundle,
  target: Platform,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const limits = getTargetLimits(target);
  const targetCaps = getPlatformCapabilities(target);

  // Check instructions
  if (bundle.contents.instructions) {
    const len = bundle.contents.instructions.length;
    const limit = limits.instructions;

    if (limit) {
      if (len > limit.hard) {
        warnings.push(
          `Instructions (${len} chars) exceed ${target} limit (${limit.hard}). Will be ${limit.overflowStrategy === 'summarize' ? 'summarized' : 'truncated'}.`,
        );
      } else if (limit.soft && len > limit.soft) {
        warnings.push(
          `Instructions (${len} chars) exceed recommended length for ${target} (${limit.soft})`,
        );
      }
    }
  }

  // Check memories
  if (bundle.contents.memories && bundle.contents.memories.count > 0) {
    if (!targetCaps.hasMemory) {
      warnings.push(
        `${target} doesn't support explicit memories. Will be converted to knowledge document.`,
      );
    } else if (targetCaps.memoryLimit && bundle.contents.memories.count > targetCaps.memoryLimit) {
      warnings.push(
        `Memory count (${bundle.contents.memories.count}) exceeds ${target} limit (${targetCaps.memoryLimit})`,
      );
    }
  }

  // Check files
  if (bundle.contents.files && bundle.contents.files.count > 0) {
    if (!targetCaps.hasFiles) {
      errors.push(`${target} doesn't support file uploads. ${bundle.contents.files.count} files cannot be migrated.`);
    } else {
      for (const file of bundle.contents.files.files) {
        if (targetCaps.fileSizeLimit && file.size > targetCaps.fileSizeLimit) {
          warnings.push(
            `File "${file.filename}" (${Math.round(file.size / 1024 / 1024)}MB) exceeds ${target} limit`,
          );
        }
      }
    }
  }

  // Check custom bots
  if (bundle.contents.customBots && bundle.contents.customBots.count > 0) {
    if (!targetCaps.hasCustomBots && !targetCaps.hasProjects) {
      warnings.push(
        `${target} doesn't support custom bots. ${bundle.contents.customBots.count} GPTs will need manual recreation.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
