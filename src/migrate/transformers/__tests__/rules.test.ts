/**
 * Tests for Transformation Rules Engine
 */

import { describe, it, expect } from 'vitest';
import {
  getTargetLimits,
  intelligentTruncate,
  splitContent,
  convertChatGPTInstructionsToClaude,
  convertClaudeInstructionsToChatGPT,
  convertMemoriesToDocument,
  convertDocumentToMemories,
  extractContextFromConversations,
  mapGPTToProject,
  validateBundleForTarget,
} from '../rules.js';
import type { MigrationBundle } from '../../types.js';

// ─── Target Limits ───────────────────────────────────────────

describe('getTargetLimits', () => {
  it('returns correct limits for Claude', () => {
    const limits = getTargetLimits('claude');

    expect(limits.instructions).toBeDefined();
    expect(limits.instructions!.hard).toBe(8000);
    expect(limits.instructions!.overflowStrategy).toBe('summarize');
    expect(limits.memories).toBeNull(); // Claude uses docs instead
  });

  it('returns correct limits for ChatGPT', () => {
    const limits = getTargetLimits('chatgpt');

    expect(limits.instructions).toBeDefined();
    expect(limits.instructions!.hard).toBe(1500);
    expect(limits.instructions!.overflowStrategy).toBe('truncate');
    expect(limits.memories).toBeDefined();
    expect(limits.memories!.hard).toBe(500);
  });

  it('throws for unknown platform', () => {
    expect(() => getTargetLimits('unknown' as any)).toThrow('Unknown platform');
  });
});

// ─── Intelligent Truncation ──────────────────────────────────

describe('intelligentTruncate', () => {
  it('returns content unchanged if within limit', () => {
    const content = 'Short content';
    const result = intelligentTruncate(content, 100);

    expect(result.success).toBe(true);
    expect(result.content).toBe(content);
    expect(result.warning).toBeUndefined();
  });

  it('removes code examples first', () => {
    const content = `Important instruction here.

\`\`\`javascript
const example = "this is a long code example that takes up space";
console.log(example);
\`\`\`

More important content.`;

    const result = intelligentTruncate(content, 100);

    expect(result.success).toBe(true);
    expect(result.content).not.toContain('```');
    expect(result.content).toContain('Important instruction');
  });

  it('removes verbose sections', () => {
    const content = `Main point here.

Note: This is a very long note that explains things in great detail and could be removed if space is needed.

Another main point.`;

    const result = intelligentTruncate(content, 80);

    expect(result.success).toBe(true);
    expect(result.warning).toBeDefined();
  });

  it('truncates at sentence boundary when necessary', () => {
    const content =
      'First sentence here. Second sentence follows. Third sentence is also present. Fourth sentence ends it.';
    const result = intelligentTruncate(content, 60);

    expect(result.success).toBe(true);
    expect(result.content!.endsWith('...')).toBe(true);
    expect(result.needsReview).toBe(true);
  });

  it('flags for review on hard truncation', () => {
    const content = 'A'.repeat(200);
    const result = intelligentTruncate(content, 50);

    expect(result.success).toBe(true);
    expect(result.content!.length).toBeLessThanOrEqual(50);
    expect(result.needsReview).toBe(true);
  });
});

// ─── Content Splitting ───────────────────────────────────────

describe('splitContent', () => {
  it('returns single chunk if within limit', () => {
    const content = 'Short content';
    const chunks = splitContent(content, 100);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(content);
  });

  it('splits by paragraphs', () => {
    const content = `First paragraph here.

Second paragraph here.

Third paragraph here.`;

    const chunks = splitContent(content, 30);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('First');
  });

  it('splits long paragraphs by sentences', () => {
    const content =
      'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.';

    const chunks = splitContent(content, 40);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(45); // Allow some tolerance
    });
  });

  it('handles content with no natural break points', () => {
    const content = 'A'.repeat(100);
    const chunks = splitContent(content, 30);

    expect(chunks.length).toBeGreaterThan(1);
  });
});

// ─── ChatGPT to Claude Instruction Conversion ────────────────

describe('convertChatGPTInstructionsToClaude', () => {
  it('combines about user and about model sections', () => {
    const aboutUser = 'I am a software developer.';
    const aboutModel = 'Respond concisely and use code examples.';

    const result = convertChatGPTInstructionsToClaude(aboutUser, aboutModel);

    expect(result).toContain('# User Context');
    expect(result).toContain('I am a software developer');
    expect(result).toContain('# Response Guidelines');
    expect(result).toContain('Respond concisely');
  });

  it('handles empty about user', () => {
    const result = convertChatGPTInstructionsToClaude('', 'Just respond well.');

    expect(result).not.toContain('User Context');
    expect(result).toContain('Response Guidelines');
  });

  it('handles empty about model', () => {
    const result = convertChatGPTInstructionsToClaude('I am a user.', '');

    expect(result).toContain('User Context');
    expect(result).not.toContain('Response Guidelines');
  });

  it('handles both empty', () => {
    const result = convertChatGPTInstructionsToClaude('', '');

    expect(result).toBe('');
  });
});

// ─── Claude to ChatGPT Instruction Conversion ────────────────

describe('convertClaudeInstructionsToChatGPT', () => {
  it('extracts sections from Claude format', () => {
    const systemPrompt = `# User Context
I am a data scientist.

# Response Guidelines
Be analytical and precise.`;

    const result = convertClaudeInstructionsToChatGPT(systemPrompt, 1500);

    expect(result.aboutUser).toContain('data scientist');
    expect(result.aboutModel).toContain('analytical');
    expect(result.overflow).toBeUndefined();
  });

  it('handles content exceeding limit', () => {
    const systemPrompt = 'A'.repeat(2000);
    const result = convertClaudeInstructionsToChatGPT(systemPrompt, 1500);

    expect(result.aboutUser.length + result.aboutModel.length).toBeLessThanOrEqual(1500);
    expect(result.overflow).toBeDefined();
  });

  it('puts all content in aboutModel if no clear sections', () => {
    const systemPrompt = 'Just some general instructions without clear sections.';
    const result = convertClaudeInstructionsToChatGPT(systemPrompt, 1500);

    expect(result.aboutUser).toBe('');
    expect(result.aboutModel).toBe(systemPrompt);
  });
});

// ─── Memory Conversions ──────────────────────────────────────

describe('convertMemoriesToDocument', () => {
  it('creates structured markdown document', () => {
    const memories = [
      { id: '1', content: 'User prefers dark mode', createdAt: '2024-01-01', category: 'Preferences' },
      { id: '2', content: 'User works on React projects', createdAt: '2024-01-02', category: 'Work' },
    ];

    const doc = convertMemoriesToDocument(memories);

    expect(doc).toContain('# User Memories');
    expect(doc).toContain('## Preferences');
    expect(doc).toContain('## Work');
    expect(doc).toContain('- User prefers dark mode');
    expect(doc).toContain('- User works on React projects');
  });

  it('groups by category', () => {
    const memories = [
      { id: '1', content: 'First', createdAt: '2024-01-01', category: 'A' },
      { id: '2', content: 'Second', createdAt: '2024-01-02', category: 'B' },
      { id: '3', content: 'Third', createdAt: '2024-01-03', category: 'A' },
    ];

    const doc = convertMemoriesToDocument(memories);

    // A should come first (more items)
    const aIndex = doc.indexOf('## A');
    const bIndex = doc.indexOf('## B');
    expect(aIndex).toBeLessThan(bIndex);
  });

  it('uses General for uncategorized', () => {
    const memories = [{ id: '1', content: 'Uncategorized memory', createdAt: '2024-01-01' }];

    const doc = convertMemoriesToDocument(memories);

    expect(doc).toContain('## General');
  });
});

describe('convertDocumentToMemories', () => {
  it('extracts memories from document', () => {
    const doc = `# Memories

## Work
- User is a developer
- User uses TypeScript

## Personal
- User likes coffee`;

    const memories = convertDocumentToMemories(doc);

    expect(memories).toHaveLength(3);
    expect(memories[0]).toEqual({ content: 'User is a developer', category: 'Work' });
    expect(memories[2]).toEqual({ content: 'User likes coffee', category: 'Personal' });
  });

  it('handles various bullet styles', () => {
    const doc = `## Items
- Dash item
* Asterisk item
• Bullet item`;

    const memories = convertDocumentToMemories(doc);

    expect(memories).toHaveLength(3);
  });
});

// ─── Conversation Context Extraction ─────────────────────────

describe('extractContextFromConversations', () => {
  it('extracts key points into document', () => {
    const summaries = [
      {
        title: 'Project Setup',
        keyPoints: ['Decided to use React', 'Will use TypeScript'],
      },
      {
        title: 'Architecture Discussion',
        keyPoints: ['Microservices approach chosen'],
      },
    ];

    const doc = extractContextFromConversations(summaries);

    expect(doc).toContain('# Conversation Insights');
    expect(doc).toContain('Decided to use React');
    expect(doc).toContain('Will use TypeScript');
    expect(doc).toContain('Microservices approach');
  });

  it('deduplicates key points', () => {
    const summaries = [
      { title: 'Conv 1', keyPoints: ['Use React'] },
      { title: 'Conv 2', keyPoints: ['Use React'] }, // Duplicate
    ];

    const doc = extractContextFromConversations(summaries);

    const matches = doc.match(/Use React/g);
    expect(matches).toHaveLength(1);
  });

  it('handles summaries without key points', () => {
    const summaries = [
      { title: 'Empty Conv', keyPoints: [] },
      { title: 'No Points' },
    ];

    const doc = extractContextFromConversations(summaries as any);

    expect(doc).toContain('No key decisions');
    expect(doc).toContain('2 conversations');
  });

  it('limits to 20 key points', () => {
    const summaries = [
      {
        title: 'Many Points',
        keyPoints: Array.from({ length: 30 }, (_, i) => `Point ${i + 1}`),
      },
    ];

    const doc = extractContextFromConversations(summaries);

    expect(doc).toContain('Point 1');
    expect(doc).toContain('Point 20');
    expect(doc).not.toContain('Point 21');
  });
});

// ─── GPT to Project Mapping ──────────────────────────────────

describe('mapGPTToProject', () => {
  it('maps GPT config to project format', () => {
    const gpt = {
      name: 'Code Helper',
      description: 'Helps with coding tasks',
      instructions: 'You are a coding assistant.',
      capabilities: ['code_interpreter', 'web_browsing'],
      knowledgeFiles: ['api-docs.pdf'],
    };

    const project = mapGPTToProject(gpt);

    expect(project.projectName).toBe('Code Helper');
    expect(project.description).toBe('Helps with coding tasks');
    expect(project.systemPrompt).toContain('You are a coding assistant');
    expect(project.systemPrompt).toContain('code_interpreter');
    expect(project.systemPrompt).toContain('web_browsing');
  });

  it('handles minimal GPT config', () => {
    const gpt = {
      name: 'Simple Bot',
      instructions: 'Be helpful.',
    };

    const project = mapGPTToProject(gpt);

    expect(project.projectName).toBe('Simple Bot');
    expect(project.description).toContain('Simple Bot');
    expect(project.systemPrompt).toBe('Be helpful.');
  });
});

// ─── Bundle Validation ───────────────────────────────────────

describe('validateBundleForTarget', () => {
  const createBundle = (overrides: Partial<MigrationBundle> = {}): MigrationBundle => ({
    version: '1.0',
    id: 'test-bundle',
    source: {
      platform: 'chatgpt',
      extractedAt: new Date().toISOString(),
      extractorVersion: '1.0.0',
    },
    contents: {},
    metadata: {
      totalItems: 0,
      itemCounts: {
        instructions: 0,
        memories: 0,
        conversations: 0,
        files: 0,
        customBots: 0,
      },
      warnings: [],
      errors: [],
    },
    ...overrides,
  });

  it('validates bundle with no issues', () => {
    const bundle = createBundle({
      contents: {
        instructions: { content: 'Short instructions', length: 20 },
      },
    });

    const result = validateBundleForTarget(bundle, 'claude');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns about instruction overflow', () => {
    const bundle = createBundle({
      contents: {
        instructions: { content: 'A'.repeat(2000), length: 2000 },
      },
    });

    const result = validateBundleForTarget(bundle, 'chatgpt');

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('exceed'))).toBe(true);
  });

  it('warns about memory conversion for Claude', () => {
    const bundle = createBundle({
      contents: {
        memories: {
          entries: [{ id: '1', content: 'Memory', createdAt: '2024-01-01' }],
          count: 1,
        },
      },
    });

    const result = validateBundleForTarget(bundle, 'claude');

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('knowledge document'))).toBe(true);
  });

  it('warns about oversized files', () => {
    const bundle = createBundle({
      contents: {
        files: {
          files: [
            {
              id: '1',
              filename: 'huge.zip',
              mimeType: 'application/zip',
              size: 100 * 1024 * 1024, // 100MB
              path: 'files/huge.zip',
            },
          ],
          count: 1,
          totalSize: 100 * 1024 * 1024,
        },
      },
    });

    const result = validateBundleForTarget(bundle, 'claude');

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('huge.zip'))).toBe(true);
  });
});
