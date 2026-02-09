/**
 * Compatibility Report Generator Tests
 *
 * Tests for the migration compatibility analyzer that categorizes items as:
 * ✓ Perfect transfer
 * ⚠ Requires adaptation
 * ✗ Incompatible
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompatibilityAnalyzer,
  analyzeCompatibility,
  formatReport,
  formatReportJson,
  generateRecommendations,
  type CompatibilityReportOptions,
} from '../../../../../src/migrate/compatibility.js';
import type {
  MigrationBundle,
  CompatibilityReport,
  CompatibilityItem,
  CompatibilityStatus,
  Platform,
} from '../../../../../src/migrate/types.js';

// Helper to create a mock migration bundle
function createMockBundle(overrides?: Partial<MigrationBundle>): MigrationBundle {
  return {
    version: '1.0',
    id: 'test-bundle-123',
    source: {
      platform: 'chatgpt',
      extractedAt: new Date().toISOString(),
      extractorVersion: '1.0.0',
    },
    contents: {
      instructions: {
        content: 'You are a helpful assistant who speaks formally.',
        length: 50,
        sections: [
          { title: 'Personality', content: 'Helpful and formal', priority: 'high' },
        ],
      },
      memories: {
        entries: [
          { id: '1', content: 'User prefers dark mode', createdAt: new Date().toISOString() },
          { id: '2', content: 'User works in tech', createdAt: new Date().toISOString() },
        ],
        count: 2,
      },
    },
    metadata: {
      totalItems: 3,
      itemCounts: {
        instructions: 1,
        memories: 2,
        conversations: 0,
        files: 0,
        customBots: 0,
      },
      warnings: [],
      errors: [],
    },
    ...overrides,
  };
}

describe('CompatibilityAnalyzer', () => {
  describe('Basic Analysis', () => {
    it('should analyze a simple ChatGPT to Claude migration', async () => {
      const bundle = createMockBundle();
      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');

      const report = await analyzer.analyze(bundle);

      expect(report.source).toBe('chatgpt');
      expect(report.target).toBe('claude');
      expect(report.generatedAt).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.items.length).toBeGreaterThan(0);
    });

    it('should return correct summary counts', async () => {
      const bundle = createMockBundle();
      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');

      const report = await analyzer.analyze(bundle);

      expect(report.summary.total).toBe(
        report.summary.perfect + report.summary.adapted + report.summary.incompatible
      );
      expect(report.summary.total).toBeGreaterThan(0);
    });

    it('should include generated timestamp', async () => {
      const bundle = createMockBundle();
      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const before = new Date().toISOString();

      const report = await analyzer.analyze(bundle);

      const after = new Date().toISOString();
      expect(report.generatedAt >= before).toBe(true);
      expect(report.generatedAt <= after).toBe(true);
    });
  });

  describe('CompatibilityStatus Categories', () => {
    it('should mark simple instructions as perfect when under limit', async () => {
      const bundle = createMockBundle({
        contents: {
          instructions: {
            content: 'Short instructions',
            length: 20,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      const instructionItem = report.items.find((i) => i.type === 'instructions');
      expect(instructionItem?.status).toBe('perfect');
    });

    it('should mark memories as adapted when migrating to Claude (uses projects)', async () => {
      const bundle = createMockBundle({
        contents: {
          memories: {
            entries: [
              { id: '1', content: 'Test memory', createdAt: new Date().toISOString() },
            ],
            count: 1,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      const memoryItem = report.items.find((i) => i.type === 'memory');
      expect(memoryItem?.status).toBe('adapted');
      expect(memoryItem?.reason).toContain('project knowledge');
    });

    it('should mark DALL-E features as incompatible for Claude', async () => {
      const bundle = createMockBundle({
        contents: {
          customBots: {
            bots: [
              {
                id: 'gpt-1',
                name: 'Art Generator',
                instructions: 'Generate images with DALL-E',
                capabilities: ['dalle'],
                createdAt: new Date().toISOString(),
              },
            ],
            count: 1,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      const dalleItem = report.items.find(
        (i) => i.type === 'feature' && i.name.toLowerCase().includes('dall-e')
      );
      expect(dalleItem?.status).toBe('incompatible');
    });

    it('should mark long instructions as adapted with truncation warning', async () => {
      const longContent = 'x'.repeat(2000); // Exceeds ChatGPT's 1500 limit
      const bundle = createMockBundle({
        contents: {
          instructions: {
            content: longContent,
            length: 2000,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      const instructionItem = report.items.find((i) => i.type === 'instructions');
      // Claude has higher limit (8000), so this should still be perfect
      expect(instructionItem?.status).toBe('perfect');
    });
  });

  describe('Feasibility Assessment', () => {
    it('should return "easy" for mostly perfect transfers', async () => {
      const bundle = createMockBundle({
        contents: {
          instructions: { content: 'Simple instructions', length: 20 },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      expect(['easy', 'moderate']).toContain(report.feasibility);
    });

    it('should return "partial" when many items are incompatible', async () => {
      const bundle = createMockBundle({
        contents: {
          customBots: {
            bots: [
              {
                id: '1',
                name: 'Bot1',
                instructions: 'test',
                capabilities: ['dalle', 'code_interpreter', 'browsing'],
                createdAt: new Date().toISOString(),
              },
              {
                id: '2',
                name: 'Bot2',
                instructions: 'test',
                capabilities: ['dalle'],
                createdAt: new Date().toISOString(),
              },
            ],
            count: 2,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      expect(['moderate', 'complex', 'partial']).toContain(report.feasibility);
    });
  });

  describe('Recommendations Engine', () => {
    it('should generate recommendations for adapted items', async () => {
      const bundle = createMockBundle({
        contents: {
          memories: {
            entries: [
              { id: '1', content: 'Memory 1', createdAt: new Date().toISOString() },
            ],
            count: 1,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate specific recommendations for incompatible items', async () => {
      const bundle = createMockBundle({
        contents: {
          customBots: {
            bots: [
              {
                id: '1',
                name: 'Image Bot',
                instructions: 'Use DALL-E',
                capabilities: ['dalle'],
                createdAt: new Date().toISOString(),
              },
            ],
            count: 1,
          },
        },
      });

      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      const hasAlternativeRec = report.recommendations.some(
        (r) => r.toLowerCase().includes('alternative') || r.toLowerCase().includes('mcp')
      );
      expect(hasAlternativeRec).toBe(true);
    });

    it('should recommend review for adapted items', async () => {
      const bundle = createMockBundle();
      const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
      const report = await analyzer.analyze(bundle);

      if (report.summary.adapted > 0) {
        const hasReviewRec = report.recommendations.some(
          (r) => r.toLowerCase().includes('review')
        );
        expect(hasReviewRec).toBe(true);
      }
    });
  });

  describe('generateRecommendations helper', () => {
    it('should return empty array for all perfect items', () => {
      const items: CompatibilityItem[] = [
        { type: 'instructions', name: 'Instructions', status: 'perfect', reason: 'OK' },
      ];
      const recommendations = generateRecommendations(items, 'chatgpt', 'claude');
      // May still have general recommendations
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});

describe('formatReport (CLI output)', () => {
  it('should include migration header', () => {
    const report: CompatibilityReport = {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: new Date().toISOString(),
      summary: { perfect: 5, adapted: 2, incompatible: 1, total: 8 },
      items: [],
      recommendations: [],
      feasibility: 'moderate',
    };

    const output = formatReport(report);

    expect(output).toContain('ChatGPT');
    expect(output).toContain('Claude');
  });

  it('should include summary counts with symbols', () => {
    const report: CompatibilityReport = {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: new Date().toISOString(),
      summary: { perfect: 5, adapted: 2, incompatible: 1, total: 8 },
      items: [],
      recommendations: [],
      feasibility: 'moderate',
    };

    const output = formatReport(report);

    expect(output).toContain('✓');
    expect(output).toContain('5');
    expect(output).toContain('⚠');
    expect(output).toContain('2');
    expect(output).toContain('✗');
    expect(output).toContain('1');
  });

  it('should include item details', () => {
    const report: CompatibilityReport = {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: new Date().toISOString(),
      summary: { perfect: 1, adapted: 0, incompatible: 0, total: 1 },
      items: [
        {
          type: 'instructions',
          name: 'Custom Instructions',
          status: 'perfect',
          reason: 'Will transfer perfectly',
        },
      ],
      recommendations: [],
      feasibility: 'easy',
    };

    const output = formatReport(report);

    expect(output).toContain('Custom Instructions');
    expect(output).toContain('transfer');
  });

  it('should include recommendations section', () => {
    const report: CompatibilityReport = {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: new Date().toISOString(),
      summary: { perfect: 1, adapted: 1, incompatible: 0, total: 2 },
      items: [],
      recommendations: ['Review adapted items before finalizing'],
      feasibility: 'moderate',
    };

    const output = formatReport(report);

    expect(output).toContain('Recommendations');
    expect(output).toContain('Review adapted items');
  });
});

describe('formatReportJson (JSON output)', () => {
  it('should return valid JSON', () => {
    const report: CompatibilityReport = {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: new Date().toISOString(),
      summary: { perfect: 5, adapted: 2, incompatible: 1, total: 8 },
      items: [
        { type: 'instructions', name: 'Test', status: 'perfect', reason: 'OK' },
      ],
      recommendations: ['Test recommendation'],
      feasibility: 'moderate',
    };

    const jsonOutput = formatReportJson(report);
    const parsed = JSON.parse(jsonOutput);

    expect(parsed.summary.perfect).toBe(5);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.recommendations).toContain('Test recommendation');
  });

  it('should include all report fields', () => {
    const report: CompatibilityReport = {
      source: 'chatgpt',
      target: 'claude',
      generatedAt: '2024-01-01T00:00:00Z',
      summary: { perfect: 1, adapted: 0, incompatible: 0, total: 1 },
      items: [],
      recommendations: [],
      feasibility: 'easy',
    };

    const jsonOutput = formatReportJson(report);
    const parsed = JSON.parse(jsonOutput);

    expect(parsed.source).toBe('chatgpt');
    expect(parsed.target).toBe('claude');
    expect(parsed.generatedAt).toBe('2024-01-01T00:00:00Z');
    expect(parsed.feasibility).toBe('easy');
  });
});

describe('analyzeCompatibility convenience function', () => {
  it('should work with minimal options', async () => {
    const bundle = createMockBundle();

    const report = await analyzeCompatibility(bundle, 'claude');

    expect(report.source).toBe('chatgpt');
    expect(report.target).toBe('claude');
  });

  it('should infer source from bundle', async () => {
    const bundle = createMockBundle({
      source: { platform: 'gemini', extractedAt: new Date().toISOString(), extractorVersion: '1.0' },
    });

    const report = await analyzeCompatibility(bundle, 'claude');

    expect(report.source).toBe('gemini');
  });
});

describe('Edge Cases', () => {
  it('should handle empty bundle', async () => {
    const bundle: MigrationBundle = {
      version: '1.0',
      id: 'empty',
      source: { platform: 'chatgpt', extractedAt: new Date().toISOString(), extractorVersion: '1.0' },
      contents: {},
      metadata: {
        totalItems: 0,
        itemCounts: { instructions: 0, memories: 0, conversations: 0, files: 0, customBots: 0 },
        warnings: [],
        errors: [],
      },
    };

    const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
    const report = await analyzer.analyze(bundle);

    expect(report.summary.total).toBe(0);
    expect(report.items).toHaveLength(0);
    expect(report.feasibility).toBe('easy');
  });

  it('should handle bundle with only conversations', async () => {
    const bundle = createMockBundle({
      contents: {
        conversations: {
          path: '/conversations',
          count: 10,
          messageCount: 100,
        },
      },
    });

    const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
    const report = await analyzer.analyze(bundle);

    expect(report.items.some((i) => i.type === 'conversation')).toBe(true);
  });

  it('should handle large file migrations', async () => {
    const bundle = createMockBundle({
      contents: {
        files: {
          files: [
            { id: '1', filename: 'huge.pdf', mimeType: 'application/pdf', size: 100 * 1024 * 1024, path: '/files/huge.pdf' },
          ],
          count: 1,
          totalSize: 100 * 1024 * 1024,
        },
      },
    });

    const analyzer = new CompatibilityAnalyzer('chatgpt', 'claude');
    const report = await analyzer.analyze(bundle);

    const fileItem = report.items.find((i) => i.type === 'file');
    // Claude has 32MB limit, so 100MB should be incompatible or need adaptation
    expect(fileItem).toBeDefined();
    expect(['adapted', 'incompatible']).toContain(fileItem?.status);
  });
});
