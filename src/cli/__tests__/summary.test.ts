/**
 * Summary Display Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  LoadResult,
  CompatibilityReport,
  MigrationState,
} from '../../migrate/types.js';
import {
  showMigrationSummary,
  showCompatibilityReport,
  showReviewItems,
  showResumableMigrations,
  showFailedMigration,
} from '../summary.js';

describe('Summary Display', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('showMigrationSummary', () => {
    it('should display successful migration summary', () => {
      const state: MigrationState = {
        id: 'mig_test123',
        phase: 'complete',
        source: 'chatgpt',
        target: 'claude',
        startedAt: new Date().toISOString(),
        phaseStartedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        checkpoints: [],
        progress: 100,
        options: {},
      };

      const result: LoadResult = {
        success: true,
        loaded: {
          instructions: true,
          memories: 42,
          files: 3,
          customBots: 1,
        },
        created: {
          projectId: 'proj_abc',
          projectUrl: 'https://claude.ai/project/proj_abc',
        },
        warnings: [],
        errors: [],
      };

      showMigrationSummary(state, result);

      expect(consoleSpy).toHaveBeenCalled();
      // Verify key output was shown
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Complete');
      expect(output).toContain('ChatGPT');
      expect(output).toContain('Claude');
    });

    it('should show warnings when present', () => {
      const state: MigrationState = {
        id: 'mig_test123',
        phase: 'complete',
        source: 'chatgpt',
        target: 'claude',
        startedAt: new Date().toISOString(),
        phaseStartedAt: new Date().toISOString(),
        checkpoints: [],
        progress: 100,
        options: {},
      };

      const result: LoadResult = {
        success: true,
        loaded: {
          instructions: true,
          memories: 10,
          files: 0,
          customBots: 0,
        },
        warnings: ['Some memories were truncated'],
        errors: [],
      };

      showMigrationSummary(state, result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Warnings');
      expect(output).toContain('truncated');
    });
  });

  describe('showCompatibilityReport', () => {
    it('should display dry-run report', () => {
      const report: CompatibilityReport = {
        source: 'chatgpt',
        target: 'claude',
        generatedAt: new Date().toISOString(),
        summary: {
          perfect: 5,
          adapted: 2,
          incompatible: 1,
          total: 8,
        },
        items: [
          {
            type: 'instructions',
            name: 'Custom Instructions',
            status: 'perfect',
            reason: 'Will transfer without modification',
          },
          {
            type: 'memory',
            name: 'Memory Entries (42 entries)',
            status: 'adapted',
            reason: 'Claude uses project knowledge instead',
            action: 'Memories will be converted to project knowledge files',
          },
        ],
        recommendations: ['Review adapted items'],
        feasibility: 'easy',
      };

      showCompatibilityReport(report);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Compatibility Report');
      expect(output).toContain('Dry Run');
      expect(output).toContain('5 items will transfer perfectly');
      expect(output).toContain('2 items require adaptation');
    });
  });

  describe('showReviewItems', () => {
    it('should show items needing attention', () => {
      const report: CompatibilityReport = {
        source: 'chatgpt',
        target: 'claude',
        generatedAt: new Date().toISOString(),
        summary: {
          perfect: 3,
          adapted: 2,
          incompatible: 1,
          total: 6,
        },
        items: [
          {
            type: 'feature',
            name: 'DALL-E Integration',
            status: 'incompatible',
            reason: 'Not available in Claude',
            action: 'Use MCP image generation tools',
          },
          {
            type: 'memory',
            name: 'Memory Entries',
            status: 'adapted',
            reason: 'Claude uses project knowledge',
          },
        ],
        recommendations: [],
        feasibility: 'moderate',
      };

      showReviewItems(report);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Review');
      expect(output).toContain('DALL-E');
      expect(output).toContain('Memory Entries');
    });

    it('should show success message when no items need attention', () => {
      const report: CompatibilityReport = {
        source: 'chatgpt',
        target: 'claude',
        generatedAt: new Date().toISOString(),
        summary: {
          perfect: 5,
          adapted: 0,
          incompatible: 0,
          total: 5,
        },
        items: [
          {
            type: 'instructions',
            name: 'Custom Instructions',
            status: 'perfect',
            reason: 'Will transfer without modification',
          },
        ],
        recommendations: [],
        feasibility: 'easy',
      };

      showReviewItems(report);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('All items transfer perfectly');
    });
  });

  describe('showResumableMigrations', () => {
    it('should list resumable migrations', () => {
      const migrations: MigrationState[] = [
        {
          id: 'mig_abc123',
          phase: 'transforming',
          source: 'chatgpt',
          target: 'claude',
          startedAt: new Date().toISOString(),
          phaseStartedAt: new Date().toISOString(),
          checkpoints: [],
          progress: 45,
          options: {},
        },
        {
          id: 'mig_def456',
          phase: 'complete',
          source: 'claude',
          target: 'chatgpt',
          startedAt: new Date().toISOString(),
          phaseStartedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          checkpoints: [],
          progress: 100,
          options: {},
        },
      ];

      showResumableMigrations(migrations);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Interrupted');
      expect(output).toContain('mig_abc123');
      expect(output).toContain('45%');
    });

    it('should show message when no migrations to resume', () => {
      showResumableMigrations([]);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('No interrupted migrations');
    });
  });

  describe('showFailedMigration', () => {
    it('should display failure details', () => {
      const state: MigrationState = {
        id: 'mig_failed',
        phase: 'failed',
        source: 'chatgpt',
        target: 'claude',
        startedAt: new Date().toISOString(),
        phaseStartedAt: new Date().toISOString(),
        checkpoints: [],
        progress: 67,
        error: 'Authentication failed: Invalid API key',
        options: {},
      };

      showFailedMigration(state);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Failed');
      expect(output).toContain('Authentication failed');
      expect(output).toContain('--resume');
    });
  });
});
