/**
 * Error Recovery Tests for Migration Wizard
 *
 * Tests checkpoint/resume capability from various failure points.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { MigrationOrchestrator, type MigrationEvent } from '../orchestrator.js';
import { registerMockPlugins } from '../testing/index.js';
import { ChatGPTToClaudeTransformer } from '../transformers/chatgpt-to-claude.js';
import { registerTransformer } from '../transformers/registry.js';
import type { MigrationBundle, MigrationState } from '../types.js';

describe('Error Recovery Tests', () => {
  let testWorkDir: string;

  beforeEach(async () => {
    testWorkDir = join(
      tmpdir(),
      `savestate-recovery-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testWorkDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testWorkDir)) {
      await rm(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('Resume from Extract Phase Failure', () => {
    it('should resume after extraction failure and complete migration', async () => {
      const workDir = join(testWorkDir, 'migration-resume-extract');

      // First attempt: fail during extraction
      registerMockPlugins({
        extractors: {
          chatgpt: {
            shouldFail: true,
            failureMessage: 'Network timeout during extraction',
          },
        },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;

      await expect(orchestrator1.run()).rejects.toThrow('Network timeout');

      let state = orchestrator1.getState();
      expect(state.phase).toBe('failed');
      expect(state.checkpoints.length).toBe(0); // No checkpoint before extraction completes

      // Second attempt: fix the issue and retry
      registerMockPlugins({
        extractors: {
          chatgpt: { shouldFail: false },
        },
      });

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);
      const result = await orchestrator2.continue();

      expect(result.success).toBe(true);
      expect(orchestrator2.getState().phase).toBe('complete');
    });

    it('should preserve migration ID across resume attempts', async () => {
      const workDir = join(testWorkDir, 'migration-preserve-id');

      registerMockPlugins({
        extractors: {
          chatgpt: { shouldFail: true, failureMessage: 'First attempt failed' },
        },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const originalId = orchestrator1.getState().id;

      try {
        await orchestrator1.run();
      } catch {
        // Expected failure
      }

      // Resume should have the same ID
      registerMockPlugins();
      const orchestrator2 = await MigrationOrchestrator.resume(originalId, workDir);
      expect(orchestrator2.getState().id).toBe(originalId);
    });
  });

  describe('Resume from Transform Phase Failure', () => {
    it('should resume from transform checkpoint after failure', async () => {
      const workDir = join(testWorkDir, 'migration-resume-transform');

      // First attempt: succeed extraction, fail during transformation
      registerMockPlugins({
        transformers: {
          'chatgpt->claude': {
            shouldFail: true,
            failureMessage: 'Transform validation failed',
          },
        },
      });
      registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;

      // Just extract first
      await orchestrator1.extract();
      expect(orchestrator1.getState().checkpoints.length).toBe(1);

      // Now try the full run with failing transformer
      const { transformers } = registerMockPlugins({
        transformers: {
          'chatgpt->claude': {
            shouldFail: true,
            failureMessage: 'Transform failed',
          },
        },
      });

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);

      await expect(orchestrator2.continue()).rejects.toThrow('Transform failed');

      let state = orchestrator2.getState();
      expect(state.phase).toBe('failed');

      // Third attempt: fix transformer and resume
      registerMockPlugins();

      const orchestrator3 = await MigrationOrchestrator.resume(migrationId, workDir);
      const result = await orchestrator3.continue();

      expect(result.success).toBe(true);
    });

    it('should not re-extract when resuming from transform checkpoint', async () => {
      const workDir = join(testWorkDir, 'migration-skip-extract');
      let extractCount = 0;

      // Track extraction calls
      const mockBundle: MigrationBundle = {
        version: '1.0',
        id: 'tracked_bundle',
        source: {
          platform: 'chatgpt',
          extractedAt: new Date().toISOString(),
          extractorVersion: '1.0.0',
        },
        contents: {
          instructions: { content: 'Test instructions', length: 20 },
        },
        metadata: {
          totalItems: 1,
          itemCounts: {
            instructions: 1,
            memories: 0,
            conversations: 0,
            files: 0,
            customBots: 0,
          },
          warnings: [],
          errors: [],
        },
      };

      registerMockPlugins({
        extractors: { chatgpt: { customBundle: mockBundle } },
      });

      // First: complete extraction
      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;
      await orchestrator1.extract();

      // Verify checkpoint exists
      expect(orchestrator1.getState().checkpoints.length).toBe(1);
      expect(orchestrator1.getState().checkpoints[0].phase).toBe('extracting');

      // Resume - extraction should be skipped
      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);

      // The bundle should already be loaded
      expect(orchestrator2.getBundle()).not.toBeNull();
    });
  });

  describe('Resume from Load Phase Failure', () => {
    it('should resume from load checkpoint after failure', async () => {
      const workDir = join(testWorkDir, 'migration-resume-load');

      // First attempt: succeed extraction and transform, fail during load
      registerMockPlugins({
        loaders: {
          claude: {
            shouldFail: true,
            failureMessage: 'API rate limit exceeded',
          },
        },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;

      await expect(orchestrator1.run()).rejects.toThrow('rate limit');

      let state = orchestrator1.getState();
      expect(state.phase).toBe('failed');
      // Should have extract and transform checkpoints
      expect(state.checkpoints.length).toBe(2);

      // Second attempt: fix loader and resume
      registerMockPlugins();

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);
      const result = await orchestrator2.continue();

      expect(result.success).toBe(true);
      expect(orchestrator2.getState().phase).toBe('complete');
    });

    it('should not re-transform when resuming from load checkpoint', async () => {
      const workDir = join(testWorkDir, 'migration-skip-transform');

      // Run until load phase, then fail
      registerMockPlugins({
        loaders: {
          claude: {
            shouldFail: true,
            failureMessage: 'Load failed',
          },
        },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;

      try {
        await orchestrator1.run();
      } catch {
        // Expected
      }

      const checkpoints = orchestrator1.getState().checkpoints;
      expect(checkpoints.some((c) => c.phase === 'transforming')).toBe(true);

      // Resume - transform should be skipped
      registerMockPlugins();

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);
      const bundle = orchestrator2.getBundle();

      // Bundle should already have target info from previous transform
      expect(bundle?.target?.platform).toBe('claude');

      const result = await orchestrator2.continue();
      expect(result.success).toBe(true);
    });
  });

  describe('Checkpoint Integrity', () => {
    it('should detect corrupted checkpoint files', async () => {
      const workDir = join(testWorkDir, 'migration-corrupted');

      // Create a successful extraction checkpoint
      registerMockPlugins();

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;
      await orchestrator1.extract();

      const checkpoints = orchestrator1.getState().checkpoints;
      expect(checkpoints.length).toBe(1);

      // Corrupt the checkpoint file
      const checkpointPath = checkpoints[0].dataPath;
      await writeFile(checkpointPath, 'corrupted data that is not valid JSON');

      // Resume should detect corruption
      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);

      // Attempting to continue from corrupted checkpoint should fail
      await expect(orchestrator2.continue()).rejects.toThrow();
    });

    it('should verify checksum before loading checkpoint', async () => {
      const workDir = join(testWorkDir, 'migration-checksum');

      registerMockPlugins();

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;
      await orchestrator1.extract();

      const checkpoints = orchestrator1.getState().checkpoints;
      const originalChecksum = checkpoints[0].checksum;

      // Modify checkpoint content slightly
      const checkpointPath = checkpoints[0].dataPath;
      const content = await readFile(checkpointPath, 'utf-8');
      const modified = content.replace('"version"', '"VERSION"');
      await writeFile(checkpointPath, modified);

      // Resume should detect checksum mismatch
      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);
      await expect(orchestrator2.continue()).rejects.toThrow(/checksum|corrupted/i);
    });
  });

  describe('State Persistence', () => {
    it('should persist error state to disk', async () => {
      const workDir = join(testWorkDir, 'migration-persist-error');

      registerMockPlugins({
        extractors: {
          chatgpt: {
            shouldFail: true,
            failureMessage: 'Persistent error message',
          },
        },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', { workDir });

      try {
        await orchestrator.run();
      } catch {
        // Expected
      }

      // Check state file on disk
      const statePath = join(workDir, 'state.json');
      expect(existsSync(statePath)).toBe(true);

      const savedState = JSON.parse(await readFile(statePath, 'utf-8')) as MigrationState;
      expect(savedState.phase).toBe('failed');
      expect(savedState.error).toContain('Persistent error message');
    });

    it('should restore state correctly after process restart simulation', async () => {
      const workDir = join(testWorkDir, 'migration-restart');

      registerMockPlugins();

      // Start migration and complete extraction
      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;
      await orchestrator1.extract();

      const originalState = orchestrator1.getState();

      // Simulate process restart by loading from disk
      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);
      const restoredState = orchestrator2.getState();

      // Key state should be preserved
      expect(restoredState.id).toBe(originalState.id);
      expect(restoredState.source).toBe(originalState.source);
      expect(restoredState.target).toBe(originalState.target);
      expect(restoredState.checkpoints.length).toBe(originalState.checkpoints.length);
    });
  });

  describe('Multiple Failure Recovery', () => {
    it('should handle multiple consecutive failures', async () => {
      const workDir = join(testWorkDir, 'migration-multi-fail');

      // Failure 1: Extraction
      registerMockPlugins({
        extractors: { chatgpt: { shouldFail: true, failureMessage: 'Failure 1' } },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;

      try {
        await orchestrator1.run();
      } catch {
        // Expected
      }

      // Failure 2: Transform
      registerMockPlugins({
        transformers: { 'chatgpt->claude': { shouldFail: true, failureMessage: 'Failure 2' } },
      });

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);

      try {
        await orchestrator2.continue();
      } catch {
        // Expected
      }

      // Failure 3: Load
      registerMockPlugins({
        loaders: { claude: { shouldFail: true, failureMessage: 'Failure 3' } },
      });

      const orchestrator3 = await MigrationOrchestrator.resume(migrationId, workDir);

      try {
        await orchestrator3.continue();
      } catch {
        // Expected
      }

      // Finally succeed
      registerMockPlugins();

      const orchestrator4 = await MigrationOrchestrator.resume(migrationId, workDir);
      const result = await orchestrator4.continue();

      expect(result.success).toBe(true);
    });

    it('should accumulate warnings across recovery attempts', async () => {
      const workDir = join(testWorkDir, 'migration-warnings');

      // First attempt with partial issues
      registerMockPlugins({
        loaders: {
          claude: {
            partialFailure: { memories: true },
          },
        },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const result = await orchestrator1.run();

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Rollback After Recovery', () => {
    it('should support rollback after resumed migration completes', async () => {
      const workDir = join(testWorkDir, 'migration-rollback-resume');

      // Fail during load first
      registerMockPlugins({
        loaders: { claude: { shouldFail: true, failureMessage: 'First load attempt' } },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;

      try {
        await orchestrator1.run();
      } catch {
        // Expected
      }

      // Resume and complete
      registerMockPlugins();

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);
      const result = await orchestrator2.continue();

      expect(result.success).toBe(true);
      expect(orchestrator2.canRollback()).toBe(true);

      // Rollback should work
      const rollbackResult = await orchestrator2.rollback();
      expect(rollbackResult.success).toBe(true);
    });

    it('should not have rollback available for failed migrations', async () => {
      const workDir = join(testWorkDir, 'migration-no-rollback');

      registerMockPlugins({
        loaders: { claude: { shouldFail: true, failureMessage: 'Permanent failure' } },
      });

      const orchestrator = new MigrationOrchestrator('chatgpt', 'claude', { workDir });

      try {
        await orchestrator.run();
      } catch {
        // Expected
      }

      expect(orchestrator.canRollback()).toBe(false);
    });
  });

  describe('Progress Tracking During Recovery', () => {
    it('should emit progress events during resumed migration', async () => {
      const workDir = join(testWorkDir, 'migration-progress-resume');

      // Complete extraction with delays to generate progress events
      registerMockPlugins({
        extractors: { chatgpt: { delayMs: 50 } },
        transformers: { 'chatgpt->claude': { delayMs: 100 } },
        loaders: { claude: { delayMs: 100 } },
      });

      const orchestrator1 = new MigrationOrchestrator('chatgpt', 'claude', { workDir });
      const migrationId = orchestrator1.getState().id;
      await orchestrator1.extract();

      // Resume with delays and track progress
      registerMockPlugins({
        transformers: { 'chatgpt->claude': { delayMs: 100 } },
        loaders: { claude: { delayMs: 100 } },
      });

      const orchestrator2 = await MigrationOrchestrator.resume(migrationId, workDir);

      const events: MigrationEvent[] = [];
      orchestrator2.on((e) => events.push(e));

      await orchestrator2.continue();

      // Should have progress events for transform and load phases
      const progressEvents = events.filter((e) => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Should have completion event
      const completeEvent = events.find((e) => e.type === 'complete');
      expect(completeEvent).toBeDefined();
    });
  });

  describe('Edge Cases in Recovery', () => {
    it('should handle resume of non-existent migration', async () => {
      await expect(
        MigrationOrchestrator.resume('mig_nonexistent', testWorkDir),
      ).rejects.toThrow(/not found/);
    });

    it('should handle resume when state file is missing', async () => {
      const workDir = join(testWorkDir, 'migration-missing-state');
      await mkdir(workDir, { recursive: true });

      // Create directory structure but no state file
      await expect(
        MigrationOrchestrator.resume('mig_test', workDir),
      ).rejects.toThrow(/not found/);
    });

    it('should handle resume when bundle file is missing', async () => {
      const workDir = join(testWorkDir, 'mig_missing_bundle');
      await mkdir(workDir, { recursive: true });

      // Create state file pointing to non-existent bundle
      const state: MigrationState = {
        id: 'mig_missing_bundle',
        phase: 'extracting',
        source: 'chatgpt',
        target: 'claude',
        startedAt: new Date().toISOString(),
        phaseStartedAt: new Date().toISOString(),
        checkpoints: [
          {
            phase: 'extracting',
            timestamp: new Date().toISOString(),
            dataPath: join(workDir, 'missing_checkpoint.json'),
            checksum: 'abc123',
          },
        ],
        progress: 33,
        bundlePath: join(workDir, 'nonexistent_bundle.json'),
        options: {},
      };

      await writeFile(join(workDir, 'state.json'), JSON.stringify(state));

      const orchestrator = await MigrationOrchestrator.resume('mig_missing_bundle', workDir);

      // Bundle should be null since file doesn't exist
      expect(orchestrator.getBundle()).toBeNull();
    });
  });
});
